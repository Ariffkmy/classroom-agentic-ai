// AI Orchestrator — the central coordinator of the Agentic AI Smart Classroom.
//
// It owns the lesson state, receives meaningful lesson events (final transcript
// segments, teacher commands, UI actions), decides what to do, delegates to the
// specialist agents and runs slow work as background tasks so the live lesson
// is never blocked. Every decision is written to the agent activity log.

import type {
  AgentName, AssetFormat, ChatTurn, ClassroomState, GeneratedAsset, GenerationTask, LogEntry,
  Quiz, QuizQuestion, ReelConfig, Scene, Settings, ValidationCheck,
} from "./types";
import { getTopic, TOPICS, type TopicEntry } from "./curriculum";
import { classify, classifyReply, extractConcepts, extractKeywords, isAddressedToAI, parseIntent, scoreSegment, withoutWake, type Intent } from "./agents/listening";
import { checksPassed, pendingChecks, validateAsset, validateQuiz } from "./agents/validator";
import { analyse } from "./agents/assessment";
import { Speaker, type VoiceChoice } from "./voice";
import { llmCall, llmStatus, llmStream } from "./llm";
import { DEMO_SCRIPTS } from "./demoScripts";
import { composeOffline } from "./reel/composer";
import { planToScenes, sanitizePlan, wordsTarget, type ReelInput, type ReelPlan } from "./reel/plan";
import { DEFAULT_REEL, reelLanguage, reelStyle } from "./reel/styles";

const uid = (p = "") => p + Math.random().toString(36).slice(2, 9);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STORAGE_KEY = "asc-state-v1";
const CHANNEL = "asc-display";
const GROUPS = ["Group A", "Group B", "Group C", "Group D", "Group E", "Group F"];
const SCORE_DECAY = 0.6;
const CONFIDENT = 0.5;
const SCRIPT_SEGMENTS = 14; // how much recent teaching a script is written from
const REPLY_WINDOW_MS = 10000; // after an AI reply, the teacher can answer without the wake phrase
const REPLY_EXTEND_MS = 4000; // keeps the window open while the teacher is mid-sentence
const CHAT_TURNS = 6;

interface ReelJob { focus?: string; variant?: boolean; keepTitle?: boolean }
interface ReelResult { title: string; scenes: Scene[]; provider: string; motif?: string; notes?: string }

interface ContentTaskOptions {
  topicId: string; title: string; format: AssetFormat; brief: string; reason: string;
  requestedBy: "agent" | "teacher"; objectives: { code: string; text: string }[];
  write: (stage: (name: string, progress: number) => void) => Promise<ReelResult>;
  job?: ReelJob; revisionOf?: string; isFallbackFor?: string; fast?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  reel: DEFAULT_REEL,
  autoGenerate: true,
  autoPresent: true,
  voiceOutput: true,
  narration: true,
  failureMode: "none",
  pauseThresholdMs: 2500,
  cooldownMs: 45000,
};

function initialState(settings: Settings = DEFAULT_SETTINGS): ClassroomState {
  return {
    lesson: { id: null, status: "idle", startedAt: null, endedAt: null },
    listening: "off",
    lastTeacherSpeechAt: 0,
    interim: "",
    transcript: [],
    context: {
      subject: null, topicId: null, topic: null, level: null, confidence: 0, status: "listening",
      concepts: [], keywords: [], summary: [], scores: {}, topicHistory: [], source: "none",
    },
    curriculum: null,
    tasks: [],
    assets: [],
    quizzes: [],
    quizSession: null,
    insights: null,
    presentation: { mode: "idle", scene: 0, playing: false, sceneStartedAt: 0 },
    log: [],
    settings,
    voice: { speaking: false, queue: 0 },
    conversation: { turns: [], thinking: false, listeningUntil: 0 },
    demo: { running: false, script: null, index: 0, total: 0 },
    aiProvider: { llm: false },
    teacherActions: [],
  };
}

type Recipe = (s: ClassroomState) => void;

export class ClassroomEngine {
  private state: ClassroomState = initialState();
  private listeners = new Set<() => void>();
  private channel: BroadcastChannel | null = null;
  private speaker = new Speaker();
  private speechQueue: { text: string; immediate?: boolean; reply?: boolean }[] = [];
  private replyRun = 0; // bumping this orphans whatever reply was in progress
  private replyAbort: AbortController | null = null;
  private replySentences: string[] = [];
  private replySpeaking = false;
  private replyStreamDone = false;
  private speakingUntilIgnore = 0;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private saveHandle: ReturnType<typeof setTimeout> | null = null;
  private broadcastHandle: ReturnType<typeof setTimeout> | null = null;
  private demoNextAt = 0;
  private demoTyping: { words: string[]; shown: number; nextAt: number } | null = null;
  private exampleIdx = 0;
  private lastLlmClassifyAt = 0;
  private lastAgentTaskAt = 0;
  private lastAgentTaskTopic: string | null = null;
  private quizPrepTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  // ---------- store plumbing ----------

  getState = () => this.state;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private update(recipe: Recipe) {
    const next = structuredClone(this.state);
    recipe(next);
    this.state = next;
    this.listeners.forEach((l) => l());
    this.scheduleBroadcast();
    this.scheduleSave();
  }

  private log(agent: AgentName, kind: LogEntry["kind"], message: string, detail?: string) {
    this.update((s) => {
      s.log.push({ id: uid(), t: Date.now(), agent, kind, message, detail });
      if (s.log.length > 250) s.log.splice(0, s.log.length - 250);
    });
  }

  private teacherAction(action: string, ref?: string) {
    this.update((s) => {
      s.teacherActions.push({ t: Date.now(), action, ref });
    });
  }

  start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.restore();
    this.channel = new BroadcastChannel(CHANNEL);
    this.channel.onmessage = (e) => {
      const m = e.data;
      if (m?.type === "hello") this.broadcastNow();
      if (m?.type === "cmd") this.handleDisplayCommand(m.cmd);
    };
    this.tickHandle = setInterval(() => this.tick(), 250);
    llmStatus().then((r) =>
      this.update((s) => {
        s.aiProvider = { llm: r.enabled, model: r.model, engine: r.engine };
      }),
    );
  }

  stop() {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.channel?.close();
    this.started = false;
  }

  private scheduleBroadcast() {
    if (this.broadcastHandle) return;
    this.broadcastHandle = setTimeout(() => {
      this.broadcastHandle = null;
      this.broadcastNow();
    }, 60);
  }

  private broadcastNow() {
    try {
      this.channel?.postMessage({ type: "state", state: this.state });
    } catch {
      /* ignore */
    }
  }

  private scheduleSave() {
    if (this.saveHandle) return;
    this.saveHandle = setTimeout(() => {
      this.saveHandle = null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        /* storage unavailable */
      }
    }, 800);
  }

  /** NFR-02 / §15: preserve session state across reloads or network interruptions. */
  private restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as ClassroomState;
      const base = initialState({ ...DEFAULT_SETTINGS, ...saved.settings, failureMode: "none" });
      if (saved.lesson?.status !== "live") {
        this.state = base;
        return;
      }
      this.state = {
        ...base,
        ...saved,
        listening: "off",
        interim: "",
        voice: { speaking: false, queue: 0 },
        conversation: { turns: saved.conversation?.turns ?? [], thinking: false, listeningUntil: 0 },
        demo: base.demo,
        presentation: base.presentation,
        settings: { ...DEFAULT_SETTINGS, ...saved.settings, failureMode: "none" },
        tasks: saved.tasks.map((t) =>
          ["planned", "generating", "validating"].includes(t.status)
            ? { ...t, status: "failed", error: "Interrupted — session restored. Retry available." }
            : t,
        ),
      };
      this.log("System", "info", "Lesson session restored after reload. Listening is off until the teacher resumes.");
    } catch {
      /* ignore corrupt state */
    }
  }

  reset(keepFaultDrill = false) {
    this.cancelReply();
    this.speaker.cancel();
    this.speechQueue = [];
    this.demoTyping = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    const ai = this.state.aiProvider;
    this.update((s) => {
      Object.assign(s, initialState({ ...s.settings, failureMode: keepFaultDrill ? s.settings.failureMode : "none" }));
      s.aiProvider = ai;
    });
  }

  // ---------- lesson lifecycle ----------

  startLesson() {
    if (this.state.lesson.status === "live") return;
    this.reset(true);
    this.update((s) => {
      s.lesson = { id: uid("lesson_"), status: "live", startedAt: Date.now(), endedAt: null };
    });
    this.log("Orchestrator", "info", "Lesson session started. No subject or topic was entered — I will infer them from the teacher's speech.");
    this.teacherAction("start_lesson");
  }

  endLesson() {
    this.stopDemo();
    this.cancelReply();
    this.closeConversation();
    this.speaker.cancel();
    this.speechQueue = [];
    this.update((s) => {
      s.lesson.status = "ended";
      s.lesson.endedAt = Date.now();
      s.listening = "off";
      s.presentation = { mode: "idle", scene: 0, playing: false, sceneStartedAt: 0 };
      s.voice = { speaking: false, queue: 0 };
      for (const t of s.tasks) if (["planned", "generating", "validating"].includes(t.status)) t.status = "cancelled";
    });
    this.log("Orchestrator", "success", "Lesson ended. Raw audio was never stored; only the transcript summary and class-level results are retained for this session.");
    this.teacherAction("end_lesson");
  }

  setListening(status: ClassroomState["listening"]) {
    if (this.state.listening === status) return;
    this.update((s) => {
      s.listening = status;
      if (status !== "listening") s.interim = "";
    });
    const msg: Record<string, string> = {
      listening: "Microphone ON — listening to the teacher (audio is processed live, never stored).",
      paused: "Listening paused by teacher. Microphone processing stopped.",
      off: "Listening stopped.",
      denied: "Microphone permission denied — switched to text-input fallback.",
      unsupported: "Live speech recognition not supported in this browser — use text input or the demo script.",
    };
    this.log("Listening", status === "denied" || status === "unsupported" ? "warning" : "info", msg[status]);
    if (status === "paused" || status === "listening") this.teacherAction(`listening_${status}`);
  }

  updateSettings(patch: Partial<Settings>) {
    this.update((s) => {
      s.settings = { ...s.settings, ...patch };
    });
    const k = Object.keys(patch)[0];
    this.teacherAction(`setting_${k}`, String(Object.values(patch)[0]));
    if ("autoPresent" in patch || "autoGenerate" in patch)
      this.log("Orchestrator", "info", `Teacher set ${k === "autoPresent" ? "automatic presentation" : "autonomous generation"} ${Object.values(patch)[0] ? "ON" : "OFF"}.`);
    if (patch.failureMode && patch.failureMode !== "none")
      this.log("System", "warning", `Fault injection armed: the next content task will simulate a ${patch.failureMode === "generation" ? "video-provider failure" : "failed validation check"}.`);
  }

  updateReel(patch: Partial<ReelConfig>) {
    this.update((s) => {
      s.settings.reel = { ...s.settings.reel, ...patch };
    });
    const [k, v] = Object.entries(patch)[0];
    this.teacherAction(`reel_${k}`, String(v));
  }

  // ---------- Listening input ----------

  /** Should microphone results be ignored (AI's own voice echo)? */
  get isEchoWindow() {
    return this.state.voice.speaking || Date.now() < this.speakingUntilIgnore;
  }

  setInterim(text: string) {
    this.update((s) => {
      s.interim = text;
      if (text) s.lastTeacherSpeechAt = Date.now();
      if (text && s.conversation.listeningUntil) s.conversation.listeningUntil = Math.max(s.conversation.listeningUntil, Date.now() + REPLY_EXTEND_MS);
    });
  }

  ingest(raw: string, source: "mic" | "demo" | "text" = "text") {
    const text = raw.trim();
    if (!text) return;
    if (this.state.lesson.status !== "live") this.startLesson();
    const inWindow = source !== "demo" && Date.now() < this.state.conversation.listeningUntil;
    const reply = inWindow && !isAddressedToAI(text) ? classifyReply(text) : "teaching";
    const addressed = isAddressedToAI(text) || reply !== "teaching";
    this.update((s) => {
      s.transcript.push({ id: uid(), t: Date.now(), speaker: "teacher", text, addressedToAI: addressed, source });
      if (s.transcript.length > 300) s.transcript.splice(0, s.transcript.length - 300);
      s.interim = "";
      s.lastTeacherSpeechAt = Date.now();
    });

    if (reply === "close") {
      this.closeConversation();
      this.log("Listening", "info", "Teacher closed the conversation.");
      return;
    }
    if (addressed) {
      const parsed = parseIntent(text);
      // Mid-conversation, "another example" means another one than the AI just gave, which a
      // stored answer can't do, so it goes to the model along with the conversation so far.
      const refine = inWindow && this.state.aiProvider.llm && ["example", "simpler", "summary"].includes(parsed.type);
      const intent: Intent = refine ? { type: "question", text: withoutWake(text) } : parsed;
      this.log("Listening", "decision", `${inWindow ? "Reply in the conversation" : "Direct request to the AI"} detected → intent "${intent.type}".`, text);
      void this.handleIntent(intent, text);
      return;
    }
    if (inWindow) this.closeConversation(); // the teacher has gone back to teaching
    this.understand(text);
  }

  // ---------- Lesson understanding (Listening + Curriculum agents) ----------

  private understand(text: string) {
    const segScores = scoreSegment(text);
    const prev = this.state.context;
    const scores: Record<string, number> = {};
    for (const [k, v] of Object.entries(prev.scores)) scores[k] = v * SCORE_DECAY;
    for (const [k, v] of Object.entries(segScores)) scores[k] = (scores[k] ?? 0) + v;
    // keep cumulative evidence for the current topic so it doesn't fade during examples
    const { topicId, confidence } = classify(scores);
    const kw = extractKeywords(text);

    const isNewTopic = topicId && confidence >= CONFIDENT && topicId !== prev.topicId;
    const topic = getTopic(isNewTopic ? topicId : prev.topicId);

    this.update((s) => {
      s.context.scores = scores;
      s.context.keywords = [...new Set([...s.context.keywords, ...kw])].slice(-16);
      if (isNewTopic) return;
      if (s.context.topicId && topicId === s.context.topicId) s.context.confidence = Math.max(confidence, s.context.confidence * 0.97);
      else if (!s.context.topicId) s.context.confidence = confidence;
    });

    if (isNewTopic && topic) {
      const changed = prev.topicId !== null;
      this.update((s) => {
        s.context.subject = topic.subject;
        s.context.topicId = topic.id;
        s.context.topic = topic.topic;
        s.context.level = topic.level;
        s.context.confidence = confidence;
        s.context.status = "confident";
        s.context.source = "dataset";
        s.context.concepts = [];
        s.context.topicHistory.push({ t: Date.now(), topic: topic.topic });
        s.context.summary.push(
          changed ? `Topic changed to ${topic.topic} (${topic.subject}).` : `Lesson identified: ${topic.subject} — ${topic.topic}, focusing on ${topic.summaryHint}.`,
        );
      });
      if (changed) this.log("Listening", "warning", `Topic change detected: "${prev.topic}" → "${topic.topic}". Updating lesson context.`);
      this.log(
        "Listening",
        "decision",
        `Identified subject "${topic.subject}", topic "${topic.topic}" (confidence ${(confidence * 100).toFixed(0)}%).`,
        `Evidence keywords: ${kw.join(", ") || "accumulated across segments"}`,
      );
      void this.retrieveCurriculum(topic);
    } else if (!prev.topicId) {
      const n = this.state.transcript.filter((t) => t.speaker === "teacher" && !t.addressedToAI).length;
      const status = n >= 3 ? "general" : confidence > 0.15 ? "uncertain" : "listening";
      if (status !== prev.status) {
        this.update((s) => {
          s.context.status = status;
          if (status === "general") s.context.summary.push("Teacher is introducing the lesson; subject not yet clear — continuing with a general context.");
        });
        if (status === "general")
          this.log("Listening", "warning", "Subject not yet identifiable with confidence. Continuing with a clearly-labelled general context; no content will be generated until the topic is clearer.");
      }
      if (status === "general") void this.llmClassify();
    }

    // Concepts
    const t2 = getTopic(this.state.context.topicId);
    const newConcepts = extractConcepts(text, t2).filter((c) => !this.state.context.concepts.includes(c));
    if (newConcepts.length) {
      this.update((s) => {
        s.context.concepts.push(...newConcepts);
        s.context.summary.push(`Teacher explained: ${newConcepts.join("; ")}.`);
        if (s.context.summary.length > 12) s.context.summary.splice(1, 1);
      });
      this.log("Listening", "info", `New concept${newConcepts.length > 1 ? "s" : ""} detected: ${newConcepts.join(", ")}.`);
    }
    this.planContent();
  }

  private async llmClassify() {
    if (!this.state.aiProvider.llm || Date.now() - this.lastLlmClassifyAt < 20000) return;
    this.lastLlmClassifyAt = Date.now();
    const transcript = this.state.transcript.filter((t) => t.speaker === "teacher").slice(-8).map((t) => t.text).join(" ");
    this.log("Listening", "info", "Topic not in the configured dataset — asking the language model to infer the lesson context.");
    const r = await llmCall<{ subject: string; topic: string; level: string; confidence: number; concepts: string[]; objectives: { code: string; text: string }[]; summary: string }>(
      "classify",
      { text: transcript },
    );
    if (!r || r.confidence < 0.5 || this.state.context.topicId) return;
    const id = "llm-" + r.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    this.update((s) => {
      Object.assign(s.context, {
        subject: r.subject, topic: r.topic, topicId: id, level: r.level, confidence: r.confidence,
        status: "confident", source: "llm", concepts: r.concepts.slice(0, 6),
      });
      s.context.summary.push(r.summary);
      s.context.topicHistory.push({ t: Date.now(), topic: r.topic });
      s.curriculum = {
        curriculum: "AI-inferred", subject: r.subject, level: r.level, unit: r.topic,
        objectives: r.objectives.slice(0, 4), source: "Inferred by language model — NOT verified against an official source", verified: false,
      };
    });
    this.log("Listening", "decision", `LLM inferred "${r.subject} — ${r.topic}" (${Math.round(r.confidence * 100)}%).`);
    this.log("Curriculum", "warning", "No configured curriculum source for this topic. Objectives are labelled UNVERIFIED.");
    this.planContent();
  }

  private async retrieveCurriculum(topic: TopicEntry) {
    this.log("Curriculum", "info", `Retrieving curriculum context for "${topic.topic}"…`);
    await sleep(700);
    if (this.state.context.topicId !== topic.id) return;
    this.update((s) => {
      s.curriculum = topic.curriculum;
    });
    this.log(
      "Curriculum",
      topic.curriculum.verified ? "success" : "warning",
      `Mapped to ${topic.curriculum.curriculum} ${topic.curriculum.level} · ${topic.curriculum.unit} (${topic.curriculum.objectives.length} learning standards).`,
      topic.curriculum.verified ? topic.curriculum.source : `${topic.curriculum.source}. Labelled as unverified.`,
    );
    this.planContent();
  }

  /** FR-01: optional teacher correction of the AI's interpretation. */
  correctTopic(topicId: string) {
    const topic = getTopic(topicId);
    if (!topic || topic.id === this.state.context.topicId) return;
    const prev = this.state.context.topic;
    this.update((s) => {
      Object.assign(s.context, {
        subject: topic.subject, topicId: topic.id, topic: topic.topic, level: topic.level, confidence: 1,
        status: "confident", source: "dataset", concepts: [],
      });
      s.context.scores = { [topic.id]: 20 };
      s.context.topicHistory.push({ t: Date.now(), topic: topic.topic });
      s.context.summary.push(`Teacher corrected the topic to ${topic.topic}.`);
    });
    this.log("Orchestrator", "info", `Teacher corrected the interpretation${prev ? ` from "${prev}"` : ""} to "${topic.topic}".`);
    this.teacherAction("correct_topic", topic.id);
    void this.retrieveCurriculum(topic);
  }

  // ---------- Autonomous content planning (Orchestrator) ----------

  private planContent() {
    const s = this.state;
    const topic = getTopic(s.context.topicId);
    if (s.context.status !== "confident" || !s.curriculum || !s.settings.autoGenerate) return;
    // Frequency limit (§18) — a new topic is a genuine new need, so it is exempt.
    if (this.lastAgentTaskTopic === s.context.topicId && Date.now() - this.lastAgentTaskAt < s.settings.cooldownMs) return;
    const existing = s.tasks.some((t) => t.kind === "content" && t.topicId === s.context.topicId && !["failed", "cancelled"].includes(t.status) && !t.isFallbackFor);
    if (existing) return;

    if (topic) {
      if (!s.context.concepts.includes(topic.planTrigger)) return;
      this.lastAgentTaskAt = Date.now();
      this.lastAgentTaskTopic = topic.id;
      const objs = topic.curriculum.objectives.slice(1, 4).map((o) => o.code).join(", ");
      this.log(
        "Orchestrator",
        "decision",
        `Teacher has explained "${topic.planTrigger}" verbally only. A concrete visual would help students. Decision: write a script from what the teacher said and build a narrated video in the background.`,
        `Supports objectives ${objs}. No similar asset exists for this topic. Teacher can keep teaching.`,
      );
      this.createReelTask({ topicId: topic.id, reason: `Make "${topic.planTrigger}" concrete`, requestedBy: "agent", objectives: topic.curriculum.objectives.slice(0, 4) });
    } else if (s.context.source === "llm" && s.aiProvider.llm) {
      this.lastAgentTaskAt = Date.now();
      this.lastAgentTaskTopic = s.context.topicId;
      this.log("Orchestrator", "decision", `Lesson on "${s.context.topic}" would benefit from a visual. Asking the Content agent to write one from what the teacher said.`);
      this.createReelTask({ topicId: s.context.topicId!, reason: "Make the idea concrete", requestedBy: "agent", objectives: s.curriculum?.objectives ?? [] });
    }
  }

  // ---------- Script writing (Content agent, after Reel Studio's plan step) ----------

  private reelInput(topicName: string, job: ReelJob): ReelInput {
    const s = this.state;
    const cfg = s.settings.reel;
    const style = reelStyle(cfg.style);
    const lang = reelLanguage(cfg.language);
    return {
      subject: s.context.subject ?? "General", topic: topicName, level: s.context.level ?? "Secondary",
      concepts: s.context.concepts, keywords: s.context.keywords,
      objectives: (s.curriculum?.objectives ?? []).map((x) => `${x.code} ${x.text}`),
      sentences: s.transcript.filter((t) => t.speaker === "teacher" && !t.addressedToAI).slice(-SCRIPT_SEGMENTS).map((t) => t.text),
      focus: job.focus, variant: job.variant,
      style: { name: style.name, brief: style.brief }, language: { label: lang.label, rules: lang.rules },
      lengthSec: cfg.lengthSec, wordsTarget: wordsTarget(cfg),
    };
  }

  /** Turns what the Listening agent heard into a script and scenes. Nothing here is pre-written. */
  private async writeReel(job: ReelJob, stage: (name: string, progress: number) => void): Promise<ReelResult> {
    const cfg = this.state.settings.reel;
    const input = this.reelInput(this.state.context.topic ?? "this lesson", job);
    stage(`Reading ${input.sentences.length} lesson segments`, 12);
    let plan: ReelPlan | null = null;
    let provider = "On-device composer (teacher's own sentences)";
    const ai = this.state.aiProvider;
    if (ai.llm) {
      stage(`Writing the script with ${ai.model}`, 30);
      plan = sanitizePlan(await llmCall("reel", { reel: input }));
      if (plan) provider = ai.model ?? "Claude";
      else this.log("Content", "warning", "The language model gave no usable script. Writing it on-device from the teacher's sentences instead.");
    }
    if (!plan) {
      stage("Writing the script from the teacher's sentences", 60);
      plan = composeOffline(input, cfg.language);
    }
    if (!plan) throw new Error("Not enough of the lesson has been heard yet to write a script");
    stage("Building scenes and timing the narration", 90);
    return { title: plan.title, scenes: planToScenes(plan, cfg), provider, motif: plan.motif, notes: plan.notes };
  }

  // ---------- Background generation pipeline (Content agent + workers) ----------

  private createReelTask(o: {
    topicId: string; reason: string; requestedBy: "agent" | "teacher"; objectives: { code: string; text: string }[];
    title?: string; brief?: string; revisionOf?: string; job?: ReelJob;
  }) {
    const job = o.job ?? {};
    const cfg = this.state.settings.reel;
    return this.createContentTask({
      topicId: o.topicId, title: o.title ?? `Video: ${this.state.context.topic ?? "this lesson"}`, format: "animation",
      brief: o.brief ?? `Narrated ${reelStyle(cfg.style).name} video, about ${cfg.lengthSec} seconds, written from the lesson transcript.`,
      reason: o.reason, requestedBy: o.requestedBy, objectives: o.objectives, revisionOf: o.revisionOf,
      write: (stage) => this.writeReel(job, stage), job,
    });
  }

  private createContentTask(o: ContentTaskOptions) {
    const task: GenerationTask = {
      id: uid("task_"), kind: "content", title: o.title, format: o.format, reason: o.reason, brief: o.brief,
      topicId: o.topicId, status: "planned", stage: "Queued for background worker", progress: 0,
      checks: pendingChecks(), createdAt: Date.now(), updatedAt: Date.now(), requestedBy: o.requestedBy,
      revisionOf: o.revisionOf, isFallbackFor: o.isFallbackFor,
    };
    this.update((s) => {
      s.tasks.unshift(task);
    });
    this.log("Content", "info", `Content brief created: "${o.title}".`, o.brief);
    void this.runContentTask(task.id, o);
    return task.id;
  }

  private patchTask(id: string, patch: Partial<GenerationTask>) {
    this.update((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (t) Object.assign(t, patch, { updatedAt: Date.now() });
    });
  }

  private taskAlive(id: string) {
    const t = this.state.tasks.find((x) => x.id === id);
    return t && t.status !== "cancelled";
  }

  private async runContentTask(
    id: string,
    o: ContentTaskOptions,
  ) {
    const failureMode = o.isFallbackFor ? "none" : this.state.settings.failureMode;
    if (failureMode !== "none") this.update((s) => void (s.settings.failureMode = "none"));
    const f = o.fast ? 0.35 : 1;
    await sleep(600 * f);
    if (!this.taskAlive(id)) return;
    this.patchTask(id, { status: "generating" });
    this.log("Orchestrator", "info", `Background worker picked up "${o.title}". Teacher can continue teaching.`);

    let result: ReelResult;
    try {
      const stage = (name: string, progress: number) => {
        if (this.taskAlive(id)) this.patchTask(id, { stage: name, progress });
      };
      if (failureMode === "generation") {
        stage("Writing the script", 30);
        await sleep(1500);
        throw new Error("Script service timed out (HTTP 504) — simulated failure");
      }
      result = await o.write(stage);
    } catch (e) {
      if (!this.taskAlive(id)) return;
      const msg = e instanceof Error ? e.message : String(e);
      this.patchTask(id, { status: "failed", error: msg, stage: "Failed" });
      this.log("Content", "error", `Generation failed: ${msg}`);
      this.log("Orchestrator", "decision", "Lesson continues uninterrupted. Falling back to a simpler visual; the teacher can retry the original animation.");
      this.say("Heads up: I couldn't finish that video, so I've prepared a simpler diagram instead.", { wait: true });
      this.createFallback(id, o.topicId);
      return;
    }

    if (!this.taskAlive(id)) return;
    const title = o.job?.keepTitle ? o.title : result.title;
    if (title !== o.title) this.patchTask(id, { title });
    const asset: GeneratedAsset = {
      id: uid("asset_"), taskId: id, title, format: o.format, topicId: o.topicId,
      objectives: o.objectives, scenes: result.scenes, createdAt: Date.now(), isFallback: Boolean(o.isFallbackFor),
      provider: result.provider,
      reel: o.job ? { motif: result.motif, language: this.state.settings.reel.language, notes: result.notes } : undefined,
    };
    if (result.notes) this.log("Content", "info", result.notes);

    // Validation
    this.patchTask(id, { status: "validating", stage: "Running automated checks", progress: 100 });
    this.log("Validator", "info", `Running ${pendingChecks().length} automated checks on "${title}".`);
    const results = validateAsset(asset, this.state.context, this.state.curriculum, { forceFail: failureMode === "validation" });
    const shown: ValidationCheck[] = pendingChecks();
    for (let i = 0; i < results.length; i++) {
      shown[i] = { ...shown[i], status: "running" };
      this.patchTask(id, { checks: structuredClone(shown) });
      await sleep(450 * f);
      if (!this.taskAlive(id)) return;
      shown[i] = results[i];
      this.patchTask(id, { checks: structuredClone(shown) });
    }
    asset.validation = results;

    if (!checksPassed(results)) {
      const failed = results.filter((c) => c.status === "fail").map((c) => c.name).join(", ");
      this.update((s) => {
        s.assets.push(asset);
      });
      this.patchTask(id, { status: "held", stage: `Held back — failed: ${failed}`, assetId: asset.id });
      this.log("Validator", "error", `Check failed (${failed}). Content held back — it will NOT be shown to students.`);
      this.log("Orchestrator", "decision", "Using a safe fallback instead of the held content.");
      this.createFallback(id, o.topicId);
      return;
    }

    this.update((s) => {
      s.assets.push(asset);
    });
    this.patchTask(id, { status: "ready", stage: "Ready — waiting for a natural pause", assetId: asset.id });
    this.log("Validator", "success", `All required checks passed for "${title}".`);
    this.queueForPresentation(asset.id);
  }

  private createFallback(failedTaskId: string, topicId: string) {
    const topic = getTopic(topicId);
    const fbScenes: Scene[] = topic
      ? topic.fallback.scenes
      : [{ title: this.state.context.topic ?? "Key idea", caption: this.state.context.summary.slice(-2).join(" "), narration: "Here is a short summary of the key idea.", visual: { kind: "emoji", emoji: ["📝"] }, durationMs: 10000 }];
    this.createContentTask({
      topicId, title: topic?.fallback.title ?? "Text summary", format: "diagram", brief: "Simple static diagram + text fallback.",
      reason: "Fallback for failed/held content", requestedBy: "agent",
      write: async () => ({ title: topic?.fallback.title ?? "Text summary", scenes: fbScenes, provider: "Built-in safe diagram" }),
      objectives: (topic?.curriculum ?? this.state.curriculum)?.objectives.slice(0, 2) ?? [], isFallbackFor: failedTaskId, fast: true,
    });
  }

  private queueForPresentation(assetId: string) {
    const s = this.state;
    if (!s.settings.autoPresent) {
      this.log("Orchestrator", "info", "Automatic presentation is OFF — content is ready for the teacher to present manually.");
      return;
    }
    this.update((st) => {
      st.presentation.waitingAssetId = assetId;
    });
    this.log("Orchestrator", "info", "Content ready. Waiting for a natural pause in the teacher's explanation before presenting.");
  }

  cancelTask(id: string) {
    this.patchTask(id, { status: "cancelled", stage: "Cancelled by teacher" });
    this.log("Orchestrator", "warning", "Generation task cancelled by teacher.");
    this.teacherAction("cancel_task", id);
  }

  retryTask(id: string) {
    const t = this.state.tasks.find((x) => x.id === id);
    if (!t) return;
    const topic = getTopic(t.topicId);
    this.teacherAction("retry_task", id);
    this.log("Orchestrator", "info", `Retrying "${t.title}".`);
    if (t.kind === "quiz") return void this.prepareQuiz(5, "teacher");
    this.createReelTask({
      topicId: t.topicId, title: t.title, brief: t.brief, reason: "Retry", requestedBy: "teacher", revisionOf: id,
      objectives: (topic?.curriculum ?? this.state.curriculum)?.objectives.slice(0, 4) ?? [],
    });
  }

  requestRevision(assetId?: string) {
    const topicId = this.state.context.topicId;
    this.teacherAction("request_revision", assetId);
    if (!topicId) return void this.say("I need a clearer topic before I can make a different version.");
    this.log("Orchestrator", "decision", "Teacher requested a different version. Rewriting the script from the lesson with a fresh angle.");
    this.createReelTask({
      topicId, reason: "Teacher requested a different version", requestedBy: "teacher", revisionOf: assetId, job: { variant: true },
      objectives: (getTopic(topicId)?.curriculum ?? this.state.curriculum)?.objectives.slice(0, 4) ?? [],
    });
  }

  generateAnimationNow() {
    const topicId = this.state.context.topicId;
    this.teacherAction("request_animation");
    if (!topicId) {
      this.say("I'm not sure of the topic yet. Could you tell me a bit more about what we're learning first?");
      return;
    }
    const hasMain = this.state.tasks.some((t) => t.kind === "content" && t.topicId === topicId && !t.isFallbackFor && !["failed", "cancelled", "held"].includes(t.status));
    if (hasMain) return this.requestRevision();
    this.createReelTask({
      topicId, reason: "Teacher requested a video", requestedBy: "teacher",
      objectives: (getTopic(topicId)?.curriculum ?? this.state.curriculum)?.objectives.slice(0, 4) ?? [],
    });
  }

  // ---------- Presentation (Classroom display) ----------

  presentAsset(assetId: string, by: "agent" | "teacher" = "teacher") {
    const asset = this.state.assets.find((a) => a.id === assetId);
    if (!asset) return;
    this.speechQueue = [];
    this.speaker.cancel();
    this.update((s) => {
      s.presentation = { mode: "content", assetId, scene: 0, playing: true, sceneStartedAt: Date.now() };
      const t = s.tasks.find((x) => x.id === asset.taskId);
      if (t) {
        t.status = "presented";
        t.stage = "Presented to class";
      }
      const a = s.assets.find((x) => x.id === assetId);
      if (a) a.presentedAt = Date.now();
    });
    this.log("Orchestrator", "success", by === "agent" ? `Natural pause detected — presenting "${asset.title}" on the classroom display.` : `Teacher presented "${asset.title}".`);
    if (by === "teacher") this.teacherAction("present", assetId);
    this.narrateScene();
  }

  private narrateScene() {
    const p = this.state.presentation;
    const a = this.state.assets.find((x) => x.id === p.assetId);
    const sc = a?.scenes[p.scene];
    if (!sc || !this.state.settings.narration || !this.state.settings.voiceOutput) return;
    const voice = a?.reel ? { lang: reelLanguage(a.reel.language).speech, voice: this.state.settings.reel.voice } : undefined;
    this.speakNow(sc.narration, false, voice);
  }

  pausePresentation() {
    this.speaker.cancel();
    this.update((s) => {
      s.presentation.playing = false;
      s.voice.speaking = false;
    });
    this.log("Orchestrator", "info", "Presentation paused by teacher.");
    this.teacherAction("pause_presentation");
  }

  resumePresentation() {
    this.update((s) => {
      s.presentation.playing = true;
      s.presentation.sceneStartedAt = Date.now();
    });
    this.teacherAction("resume_presentation");
    this.narrateScene();
  }

  gotoScene(delta: number) {
    const p = this.state.presentation;
    const a = this.state.assets.find((x) => x.id === p.assetId);
    if (!a) return;
    const next = Math.max(0, Math.min(a.scenes.length - 1, p.scene + delta));
    this.speaker.cancel();
    this.update((s) => {
      s.presentation.scene = next;
      s.presentation.sceneStartedAt = Date.now();
    });
    this.narrateScene();
  }

  dismiss(by: "teacher" | "agent" = "teacher") {
    const mode = this.state.presentation.mode;
    if (mode === "idle") return;
    this.cancelReply();
    if (by === "teacher") this.closeConversation();
    this.speaker.cancel();
    this.speechQueue = [];
    this.update((s) => {
      s.presentation = { mode: "idle", scene: 0, playing: false, sceneStartedAt: 0, waitingAssetId: s.presentation.waitingAssetId };
      s.voice.speaking = false;
    });
    if (by === "teacher") {
      this.log("Orchestrator", "info", `Teacher dismissed the ${mode === "content" ? "content" : mode}. Presentation stopped.`);
      this.teacherAction("dismiss", mode);
    }
    if (mode === "content") this.maybePrepareQuiz();
  }

  private handleDisplayCommand(cmd: string) {
    if (cmd === "dismiss") this.dismiss();
    if (cmd === "pause") this.pausePresentation();
    if (cmd === "resume") this.resumePresentation();
    if (cmd === "next") this.gotoScene(1);
    if (cmd === "prev") this.gotoScene(-1);
  }

  private showExplanation(title: string, body: string, emoji = "💡") {
    this.update((s) => {
      if (s.presentation.mode !== "idle" && s.presentation.mode !== "explanation") return;
      s.presentation = { mode: "explanation", scene: 0, playing: true, sceneStartedAt: Date.now(), explanation: { title, body, emoji }, waitingAssetId: s.presentation.waitingAssetId };
    });
  }

  // ---------- Voice agent ----------

  /** Queue speech: waits for a pause so the AI never talks over the teacher. */
  say(text: string, opts: { wait?: boolean; reply?: boolean } = {}) {
    this.update((s) => {
      s.transcript.push({ id: uid(), t: Date.now(), speaker: "ai", text });
      s.voice.last = text;
    });
    this.log("Voice", "info", `“${text}”`);
    if (opts.reply) this.addTurn("ai", text);
    if (!this.state.settings.voiceOutput) {
      if (opts.reply) this.openConversation();
      return;
    }
    this.speechQueue.push({ text, immediate: !opts.wait, reply: opts.reply });
    this.update((s) => void (s.voice.queue = this.speechQueue.length));
  }

  private speakNow(text: string, record = false, voice?: VoiceChoice, reply = false) {
    if (record) this.say(text);
    this.speaker.cancel();
    this.update((s) => void (s.voice.speaking = true));
    this.speaker.speak(
      text,
      () => this.update((s) => void (s.voice.speaking = true)),
      () => {
        this.speakingUntilIgnore = Date.now() + 700;
        this.update((s) => void (s.voice.speaking = false));
        if (reply) this.openConversation();
      },
      voice,
    );
  }

  // ---------- Conversation (turn-taking with the teacher) ----------

  private addTurn(role: "teacher" | "ai", text: string) {
    this.update((s) => {
      s.conversation.turns.push({ role, text });
      s.conversation.turns.splice(0, Math.max(0, s.conversation.turns.length - CHAT_TURNS));
    });
  }

  private openConversation() {
    this.update((s) => void (s.conversation.listeningUntil = Date.now() + REPLY_WINDOW_MS));
  }

  private closeConversation() {
    if (this.state.conversation.listeningUntil) this.update((s) => void (s.conversation.listeningUntil = 0));
  }

  /** Stops a reply wherever it is: still being written, or part-way through being spoken. */
  private cancelReply() {
    this.replyRun += 1;
    this.replyAbort?.abort();
    this.replyAbort = null;
    this.replySentences = [];
    this.replyStreamDone = false;
    const active = this.replySpeaking || this.state.conversation.thinking;
    this.replySpeaking = false;
    if (!active) return;
    this.speaker.cancel();
    this.update((s) => {
      s.conversation.thinking = false;
      s.voice.speaking = false;
    });
  }

  private replyVoice(): VoiceChoice | undefined {
    const cfg = this.state.settings.reel;
    return cfg.language === "en" ? undefined : { lang: reelLanguage(cfg.language).speech, voice: cfg.voice };
  }

  /** Speaks finished sentences one at a time, so a reply starts before it is fully written. */
  private pumpReply(): void {
    if (this.replySpeaking) return;
    const next = this.replySentences.shift();
    if (!next) {
      if (this.replyStreamDone) {
        this.replyStreamDone = false;
        this.speakingUntilIgnore = Date.now() + 700;
        this.update((s) => void (s.voice.speaking = false));
        this.openConversation();
      }
      return;
    }
    if (!this.state.settings.voiceOutput) return this.pumpReply();
    const run = this.replyRun;
    this.replySpeaking = true;
    this.speaker.speak(next, () => {}, () => {
      if (run !== this.replyRun) return;
      this.replySpeaking = false;
      this.pumpReply();
    }, this.replyVoice());
  }

  /** Returns false if no words arrived, so the caller can fall back. */
  private async streamReply(question: string, history: ChatTurn[]): Promise<boolean> {
    const ctx = this.state.context;
    const run = this.replyRun;
    const ctrl = new AbortController();
    this.replyAbort = ctrl;
    this.update((s) => void (s.conversation.thinking = true));
    const segId = uid();
    let shown = "";
    let unspoken = "";

    const onText = (chunk: string) => {
      if (run !== this.replyRun) return;
      const first = !shown;
      shown += chunk;
      unspoken += chunk;
      this.update((s) => {
        s.conversation.thinking = false;
        s.voice.speaking = this.state.settings.voiceOutput;
        s.voice.last = shown;
        if (first) s.transcript.push({ id: segId, t: Date.now(), speaker: "ai", text: shown });
        else {
          const seg = s.transcript.find((x) => x.id === segId);
          if (seg) seg.text = shown;
        }
      });
      this.showExplanation("Answer", shown.trim(), "💬");
      const SENTENCE = /^([\s\S]*?[.!?…])\s+/;
      for (let m = unspoken.match(SENTENCE); m; m = unspoken.match(SENTENCE)) {
        this.replySentences.push(m[1].trim());
        unspoken = unspoken.slice(m[0].length);
      }
      this.pumpReply();
    };

    await llmStream("answer", { text: question, history, context: { subject: ctx.subject, topic: ctx.topic, level: ctx.level, concepts: ctx.concepts, summary: ctx.summary.slice(-4) } }, onText, ctrl.signal);
    if (run !== this.replyRun) return true;
    this.replyAbort = null;
    this.update((s) => void (s.conversation.thinking = false));
    if (!shown.trim()) return false;
    if (unspoken.trim()) this.replySentences.push(unspoken.trim());
    this.addTurn("ai", shown.trim());
    this.log("Voice", "info", `“${shown.trim()}”`);
    this.replyStreamDone = true;
    this.pumpReply();
    return true;
  }

  stopSpeaking() {
    this.cancelReply();
    this.speaker.cancel();
    this.speechQueue = [];
    this.update((s) => {
      s.voice.speaking = false;
      s.voice.queue = 0;
    });
  }

  private async handleIntent(intent: Intent, raw: string) {
    this.cancelReply(); // the teacher has moved on, even if the AI was mid-sentence
    const topic = getTopic(this.state.context.topicId);
    const ctx = this.state.context;
    this.teacherAction(`voice_${intent.type}`);
    switch (intent.type) {
      case "stop":
        this.dismiss();
        this.stopSpeaking();
        this.stopDemo();
        this.say("Okay, stopping.", {});
        return;
      case "example": {
        if (!topic) return this.answerQuestion("Give an everyday example of what we are learning.");
        const ex = topic.everydayExamples[this.exampleIdx++ % topic.everydayExamples.length];
        this.log("Orchestrator", "decision", "Using current lesson context to give an everyday example; showing it on the display as well.");
        this.showExplanation("Everyday example", ex, topic.id.includes("sci") ? "🌿" : "📺");
        this.addTurn("teacher", raw);
        this.say(`Sure. ${ex.replace(/²/g, " squared")}`, { reply: true });
        return;
      }
      case "simpler":
        if (!topic) return this.answerQuestion("Explain this in simpler language.");
        this.showExplanation("In simpler words", topic.simpler, "🧩");
        this.addTurn("teacher", raw);
        this.say(topic.simpler, { reply: true });
        return;
      case "animation":
        this.say(intent.different ? "Sure, I'll make a different version in the background." : "Okay, I'll create an animation in the background. Keep going — I'll show it at a good moment.");
        if (intent.different) this.requestRevision();
        else this.generateAnimationNow();
        return;
      case "quiz":
        return this.startQuizFlow(intent.count);
      case "summary": {
        const sum = ctx.topic
          ? `So far we covered ${ctx.topic}: ${ctx.concepts.slice(0, 4).join("; ")}.`
          : "I haven't identified the topic yet.";
        this.showExplanation("Lesson summary", sum, "📝");
        this.addTurn("teacher", raw);
        this.say(sum, { reply: true });
        return;
      }
      case "question":
        return this.answerQuestion(intent.text);
    }
  }

  private async answerQuestion(q: string) {
    const topic = getTopic(this.state.context.topicId);
    this.closeConversation();
    if (this.state.presentation.mode === "content" && this.state.presentation.playing) this.pausePresentation();
    const history = this.state.conversation.turns.slice();
    this.addTurn("teacher", q);
    if (this.state.aiProvider.llm) {
      this.log("Voice", "info", "Answering with the language model, grounded in the lesson and the conversation so far.");
      if (await this.streamReply(q, history)) return;
      this.log("Voice", "warning", "The language model did not reply. Using the on-device answer instead.");
    }
    if (topic) {
      this.showExplanation("Answer", topic.simpler, "💬");
      return this.say(`Good question. In short: ${topic.simpler}`, { reply: true });
    }
    this.say("I'm not certain about that yet, and I don't want to guess. Could you rephrase, or tell me a little more about the topic?", { reply: true });
  }

  // ---------- Quiz & assessment ----------

  private maybePrepareQuiz() {
    const s = this.state;
    if (!s.settings.autoGenerate || !s.context.topicId) return;
    if (s.quizzes.some((q) => q.topicId === s.context.topicId) || s.tasks.some((t) => t.kind === "quiz" && t.topicId === s.context.topicId && t.status !== "failed")) return;
    if (this.quizPrepTimer) clearTimeout(this.quizPrepTimer);
    this.quizPrepTimer = setTimeout(() => {
      this.log("Orchestrator", "decision", "Students have now seen the explanation and a visual example. A short knowledge check would be useful — preparing a quiz in the background (it won't interrupt).");
      void this.prepareQuiz(5, "agent");
    }, 1500);
  }

  private async prepareQuiz(n: number, by: "agent" | "teacher"): Promise<string | null> {
    const ctx = this.state.context;
    const topic = getTopic(ctx.topicId);
    if (!ctx.topicId) return null;
    const task: GenerationTask = {
      id: uid("task_"), kind: "quiz", title: `Quiz: ${ctx.topic} (${n} questions)`, format: "quiz", reason: by === "agent" ? "Knowledge check" : "Teacher request",
      brief: `Multiple-choice quiz aligned to ${this.state.curriculum?.unit ?? ctx.topic}`, topicId: ctx.topicId, status: "generating", stage: "Quiz agent drafting questions",
      progress: 10, checks: [], createdAt: Date.now(), updatedAt: Date.now(), requestedBy: by,
    };
    this.update((s) => void s.tasks.unshift(task));
    this.log("Quiz", "info", `Drafting ${n} multiple-choice questions from the lesson context and learning objectives.`);

    let questions: QuizQuestion[] | null = null;
    if (topic) {
      await sleep(1600);
      questions = topic.quiz.slice(0, Math.min(n, topic.quiz.length));
    } else if (this.state.aiProvider.llm) {
      const r = await llmCall<{ questions: Omit<QuizQuestion, "id">[] }>("quiz", { n, context: { subject: ctx.subject, topic: ctx.topic, level: ctx.level, concepts: ctx.concepts } });
      questions = r?.questions?.map((q, i) => ({ ...q, id: `q${i + 1}`, objective: this.state.curriculum?.objectives[0]?.code })) ?? null;
    }
    if (!questions?.length) {
      this.patchTask(task.id, { status: "failed", error: "Could not generate questions for this topic", stage: "Failed" });
      this.say("I couldn't prepare reliable questions for this topic yet.");
      return null;
    }
    const quiz: Quiz = { id: uid("quiz_"), topicId: ctx.topicId, title: `${ctx.topic} — quick check`, questions, createdAt: Date.now(), validated: false };
    this.patchTask(task.id, { status: "validating", progress: 100, stage: "Checking answer keys & safety" });
    await sleep(900);
    const checks = validateQuiz(quiz);
    quiz.validated = checksPassed(checks);
    if (!quiz.validated) {
      this.patchTask(task.id, { status: "held", checks, stage: "Held — quiz failed checks" });
      this.log("Validator", "error", "Quiz failed checks and was held back.");
      return null;
    }
    this.update((s) => {
      s.quizzes.push(quiz);
      const t = s.tasks.find((x) => x.id === task.id);
      if (t) Object.assign(t, { status: "ready", checks, stage: "Ready — start when you like", quizId: quiz.id });
    });
    this.log("Validator", "success", `Quiz validated (${checks.length} checks). ${by === "agent" ? "Ready whenever the teacher wants a knowledge check." : ""}`);
    return quiz.id;
  }

  async startQuizFlow(n = 5) {
    const ctx = this.state.context;
    if (!ctx.topicId) {
      this.say("I haven't identified the lesson topic yet, so I can't make a fair quiz. Keep teaching and ask me again shortly.");
      return;
    }
    let quiz = [...this.state.quizzes].reverse().find((q) => q.topicId === ctx.topicId && !this.state.insights?.quizId?.includes(q.id));
    if (quiz) this.say(`I've already prepared ${quiz.questions.length} questions on ${ctx.topic}. Putting the first one on the screen now. Groups, use your answer cards.`);
    else {
      this.say(`Sure — preparing ${n} questions on ${ctx.topic}. One moment.`);
      const id = await this.prepareQuiz(n, "teacher");
      quiz = this.state.quizzes.find((q) => q.id === id);
      if (!quiz) return;
      this.say("The quiz is ready. Groups, use your answer cards.");
    }
    this.openQuiz(quiz.id);
  }

  openQuiz(quizId: string) {
    const quiz = this.state.quizzes.find((q) => q.id === quizId);
    if (!quiz) return;
    this.stopDemo();
    this.update((s) => {
      s.quizSession = {
        quizId, groups: GROUPS, current: 0, phase: "answering",
        responses: Object.fromEntries(quiz.questions.map((q) => [q.id, Object.fromEntries(GROUPS.map((g) => [g, null]))])),
      };
      s.insights = null;
      s.presentation = { mode: "quiz", scene: 0, playing: true, sceneStartedAt: Date.now(), waitingAssetId: s.presentation.waitingAssetId };
      const t = s.tasks.find((x) => x.quizId === quizId);
      if (t) Object.assign(t, { status: "presented", stage: "Quiz in progress" });
    });
    this.log("Quiz", "success", `Quiz presented on the classroom display. Responses: teacher-entered group answer cards (no student devices needed).`);
  }

  setQuizQuestion(i: number) {
    this.update((s) => {
      if (s.quizSession) s.quizSession.current = i;
    });
  }

  setResponse(questionId: string, group: string, option: number | null) {
    this.update((s) => {
      if (s.quizSession) s.quizSession.responses[questionId][group] = option;
    });
  }

  /** Demo helper: fills a realistic set of group answer cards. */
  simulateResponses() {
    const ss = this.state.quizSession;
    const quiz = this.state.quizzes.find((q) => q.id === ss?.quizId);
    if (!ss || !quiz) return;
    const PRESET: Record<string, number[]> = {
      q1: [1, 1, 1, 1, 0, 1], q2: [0, 0, 0, 1, 0, 0], q3: [1, 0, 2, 1, 1, 2], q4: [2, 2, 1, 2, 0, 2], q5: [0, 0, 1, 0, 0, 0],
    };
    this.update((s) => {
      quiz.questions.forEach((q, qi) => {
        ss.groups.forEach((g, gi) => {
          const preset = quiz.topicId === "math-pythagoras" ? PRESET[q.id]?.[gi] : undefined;
          let ans = preset;
          if (ans === undefined) {
            const correct = qi === 1 ? gi % 3 === 0 : (gi + qi * 2) % 5 !== 0;
            ans = correct ? q.answer : (q.answer + 1 + ((gi + qi) % (q.options.length - 1))) % q.options.length;
          }
          s.quizSession!.responses[q.id][g] = ans;
        });
      });
    });
    this.log("System", "info", "Demo: filled group answer cards with synthetic, non-identifiable responses.");
  }

  finishQuiz() {
    const ss = this.state.quizSession;
    const quiz = this.state.quizzes.find((q) => q.id === ss?.quizId);
    if (!ss || !quiz) return;
    this.log("Assessment", "info", "Analysing class-level responses…");
    const insights = analyse(quiz, ss);
    this.update((s) => {
      s.insights = insights;
      if (s.quizSession) s.quizSession.phase = "results";
      s.presentation = { mode: "results", scene: 0, playing: true, sceneStartedAt: Date.now(), waitingAssetId: s.presentation.waitingAssetId };
    });
    const flagged = insights.stats.filter((x) => x.flagged);
    this.log(
      "Assessment",
      flagged.length ? "warning" : "success",
      `Overall ${(insights.overallRate * 100).toFixed(0)}% correct across ${insights.sampleSize} groups. ${flagged.length ? `${flagged.length} question(s) below 60%: ${flagged.map((f) => f.questionId.toUpperCase()).join(", ")}.` : "No question below 60%."}`,
      insights.caveat,
    );
    if (flagged.length) {
      this.log("Assessment", "decision", `Weak concept(s) from response evidence: ${insights.weakConcepts.join(", ")}. Recommendation: ${insights.recommendation}`);
      this.say(
        `Results are in. Most groups did well, but question ${flagged[0].questionId.slice(1)} was tricky — only ${flagged[0].correct} of ${flagged[0].responses} groups got it right. I recommend a quick re-explanation${insights.followUp ? `, and I'm preparing a short follow-up: ${insights.followUp.title}` : ""}.`,
        { wait: true },
      );
      if (insights.followUp && this.state.settings.autoGenerate) this.generateFollowUp(true);
    } else this.say(`Great work everyone — ${(insights.overallRate * 100).toFixed(0)} percent correct overall.`, { wait: true });
  }

  generateFollowUp(auto = false) {
    const ins = this.state.insights;
    const quiz = this.state.quizzes.find((q) => q.id === ins?.quizId);
    const topic = getTopic(quiz?.topicId);
    if (!ins?.followUp || !topic) return;
    const fu = topic.followUps[ins.followUp.conceptKey];
    if (this.state.tasks.some((t) => t.title === fu.title && !["failed", "cancelled"].includes(t.status))) return;
    if (!auto) this.teacherAction("generate_follow_up");
    this.log("Orchestrator", "decision", `Generating follow-up content targeted at "${ins.followUp.conceptKey}" based on response evidence (not assumptions).`);
    this.createReelTask({
      topicId: topic.id, title: fu.title, brief: fu.explanation, reason: `Quiz evidence: low correct rate on ${ins.followUp.conceptKey}`,
      requestedBy: auto ? "agent" : "teacher", objectives: topic.curriculum.objectives.slice(0, 1),
      job: { focus: fu.explanation, keepTitle: true },
    });
  }

  closeQuiz() {
    this.update((s) => {
      s.presentation = { mode: "idle", scene: 0, playing: false, sceneStartedAt: 0, waitingAssetId: s.presentation.waitingAssetId };
    });
    this.teacherAction("close_quiz");
  }

  // ---------- Demo script runner ----------

  runDemo(key: string) {
    const script = DEMO_SCRIPTS[key];
    if (!script) return;
    if (this.state.lesson.status !== "live") this.startLesson();
    this.demoNextAt = Date.now() + 600;
    this.demoTyping = null;
    this.update((s) => {
      s.demo = { running: true, script: key, index: 0, total: script.lines.length };
    });
    this.log("System", "info", `Demo script started: ${script.label}. (Simulates the teacher's voice; the live microphone also works.)`);
  }

  stopDemo() {
    if (!this.state.demo.running) return;
    this.demoTyping = null;
    this.update((s) => {
      s.demo.running = false;
      s.interim = "";
    });
  }

  // ---------- Tick: timing-based orchestration ----------

  private tick() {
    const s = this.state;
    const now = Date.now();
    const silentFor = now - s.lastTeacherSpeechAt;

    // Demo runner (types out the teacher's line word by word like live captions)
    if (s.demo.running && s.demo.script) {
      const script = DEMO_SCRIPTS[s.demo.script];
      if (this.demoTyping) {
        if (now >= this.demoTyping.nextAt) {
          this.demoTyping.shown += 2;
          this.demoTyping.nextAt = now + 220;
          const { words, shown } = this.demoTyping;
          if (shown >= words.length) {
            this.demoTyping = null;
            const line = script.lines[s.demo.index];
            this.ingest(line.text, "demo");
            this.demoNextAt = Date.now() + line.pauseAfterMs;
            this.update((st) => {
              st.demo.index += 1;
              if (st.demo.index >= st.demo.total) st.demo.running = false;
            });
          } else this.setInterim(words.slice(0, shown).join(" "));
        }
      } else if (now >= this.demoNextAt && s.presentation.mode === "idle" && !s.voice.speaking && this.speechQueue.length === 0 && !s.presentation.waitingAssetId) {
        const line = script.lines[s.demo.index];
        if (line) this.demoTyping = { words: line.text.split(" "), shown: 0, nextAt: now };
      }
    }

    // Speech queue: only speak during a pause in the teacher's speech.
    if (this.speechQueue.length && !s.voice.speaking && !this.demoTyping) {
      const head = this.speechQueue[0];
      if (head.immediate ? silentFor > 600 : silentFor > 1200) {
        this.speechQueue.shift();
        this.update((st) => void (st.voice.queue = this.speechQueue.length));
        this.speakNow(head.text, false, undefined, head.reply);
      }
    }

    if (s.conversation.listeningUntil && now >= s.conversation.listeningUntil) this.closeConversation();
    const chatting = s.conversation.thinking || now < s.conversation.listeningUntil;

    // Natural-pause presentation.
    const waiting = s.presentation.waitingAssetId;
    if (
      waiting && !chatting && s.settings.autoPresent && s.presentation.mode === "idle" && !s.voice.speaking && this.speechQueue.length === 0 &&
      silentFor >= s.settings.pauseThresholdMs && !this.demoTyping && !s.interim
    ) {
      this.update((st) => void (st.presentation.waitingAssetId = undefined));
      this.presentAsset(waiting, "agent");
      return;
    }

    // Scene auto-advance
    const p = s.presentation;
    if (p.mode === "content" && p.playing) {
      const a = s.assets.find((x) => x.id === p.assetId);
      const sc = a?.scenes[p.scene];
      // Hold the scene while narration is still playing.
      if (sc && now - p.sceneStartedAt > sc.durationMs && !s.voice.speaking) {
        if (p.scene < a!.scenes.length - 1) {
          this.update((st) => {
            st.presentation.scene += 1;
            st.presentation.sceneStartedAt = now;
          });
          this.narrateScene();
        } else {
          this.log("Orchestrator", "info", `Finished presenting "${a!.title}".`);
          this.dismiss("agent");
        }
      }
    }
    if (p.mode === "explanation" && !chatting && !s.voice.speaking && this.speechQueue.length === 0 && now - p.sceneStartedAt > 9000) {
      this.dismiss("agent");
    }
  }
}

export const SERVER_STATE = initialState();

let engine: ClassroomEngine | null = null;
export function getEngine() {
  if (!engine) engine = new ClassroomEngine();
  return engine;
}

export { TOPICS };
