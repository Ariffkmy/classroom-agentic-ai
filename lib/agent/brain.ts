// The lesson agent's decision logic: what it observes, how its choice is checked, and the rules
// that stand in when no model is available. The engine carries the choices out.
//
// The model chooses what to do. It cannot change what is allowed: every choice passes `permit`,
// and generated content still has to pass the validator.

import type { AgentAction, AgentDecision, AgentTrigger, ClassroomState, ConceptEvidence, Patience, PlanStep } from "../types";

export const AGENT_GOAL = "Most groups understand each key idea, shown by their answers, with as little disruption to teaching as possible.";
export const PASS_RATE = 0.6;
export const MAX_MODEL_DECISIONS = 40; // per lesson; the rules take over beyond this
export const MAX_ACTS_WITHOUT_NEWS = 3; // stops the agent acting again and again with no new input
export const MIN_SEGMENTS = 3;

/** How long the agent stays quiet before showing something, and how far apart things appear. */
export const PATIENCE: Record<Patience, { label: string; pauseMs: number; gapMs: number }> = {
  quick: { label: "Quick: 4 s pause, 30 s between items", pauseMs: 4000, gapMs: 30000 },
  normal: { label: "Normal: 7 s pause, 90 s between items", pauseMs: 7000, gapMs: 90000 },
  patient: { label: "Patient: 12 s pause, 3 min between items", pauseMs: 12000, gapMs: 180000 },
};

const ACTIONS: readonly AgentAction[] = ["wait", "make_video", "prepare_quiz", "start_quiz", "start_challenge", "reexplain", "advise_teacher"];

export const ACTION_LABEL: Record<AgentAction, string> = {
  wait: "Keep listening",
  make_video: "Make a video",
  prepare_quiz: "Prepare a quiz",
  start_quiz: "Run a quiz",
  start_challenge: "Run a Class Challenge",
  reexplain: "Re-explain",
  advise_teacher: "Advise the teacher",
};

export interface Choice {
  action: AgentAction;
  focus?: string;
  say?: string;
  reason: string;
  expected?: string;
  assessment?: string;
  concepts?: string[];
  plan?: PlanStep[];
  planChange?: string;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Model output is untrusted: anything other than a known action with a reason is rejected. */
export function parseDecision(raw: unknown): Choice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const action = ACTIONS.find((a) => a === r.action);
  const reason = str(r.reason, 240);
  if (!action || !reason) return null;
  const concepts = Array.isArray(r.concepts) ? r.concepts.slice(0, 8).map((c) => str(c, 50)).filter(Boolean) : undefined;
  const statuses: PlanStep["status"][] = ["todo", "doing", "done", "dropped"];
  const plan = Array.isArray(r.plan)
    ? r.plan.slice(0, 6).map((p): PlanStep => {
        const step = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
        return { text: str(step.step, 110), status: statuses.find((x) => x === step.status) ?? "todo" };
      }).filter((p) => p.text)
    : undefined;
  return {
    action, reason, concepts, plan: plan?.length ? plan : undefined, planChange: str(r.planChange, 200) || undefined, focus: str(r.focus, 160) || undefined, say: str(r.say, 420) || undefined,
    expected: str(r.expected, 200) || undefined, assessment: str(r.assessment, 200) || undefined,
  };
}

export function parseReview(raw: unknown): { ok: boolean; issues: string[]; teacherErrors: string[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.ok !== "boolean") return null;
  const texts = (v: unknown) => (Array.isArray(v) ? v.slice(0, 6).map((i) => str(i, 220)).filter(Boolean) : []);
  const issues = texts(r.issues);
  return { ok: r.ok && !issues.length, issues, teacherErrors: texts(r.teacherErrors) };
}

export const firstRate = (e: ConceptEvidence) => e.attempts[0]?.rate ?? 0;
export const latestRate = (e: ConceptEvidence) => e.attempts[e.attempts.length - 1]?.rate ?? 0;
export const weakConcepts = (s: ClassroomState) => s.agent.evidence.filter((e) => latestRate(e) < PASS_RATE).sort((a, b) => latestRate(a) - latestRate(b)).map((e) => e.concept);

export const unusedQuiz = (s: ClassroomState) => [...s.quizzes].reverse().find((q) => q.topicId === s.context.topicId && !q.usedAt);

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

/** What the agent can see. Deliberately class-level: there is nothing about individual students. */
export function buildObservation(s: ClassroomState, trigger: AgentTrigger, cooldownLeftMs: number) {
  const ctx = s.context;
  const taught = s.transcript.filter((t) => t.speaker === "teacher" && !t.addressedToAI);
  const ins = s.insights;
  return {
    event: trigger,
    lesson: {
      subject: ctx.subject, topic: ctx.topic, level: ctx.level, minutesIn: s.lesson.startedAt ? Math.round((Date.now() - s.lesson.startedAt) / 60000) : 0,
      objectives: (s.curriculum?.objectives ?? []).map((o) => `${o.code} ${o.text}`), conceptsHeard: ctx.concepts,
      comesNextInSyllabus: s.curriculum?.next ?? [],
    },
    recentTeaching: taught.slice(-8).map((t) => t.text),
    yourPlan: s.agent.lessonPlan?.steps.map((p) => ({ step: p.text, status: p.status })) ?? null,
    videos: s.tasks.filter((t) => t.kind === "content").slice(0, 6).map((t) => ({ title: t.title, status: t.status, why: t.reason })),
    quizzes: s.quizzes.map((q) => ({ title: q.title, questions: q.questions.length, alreadyRun: Boolean(q.usedAt) })),
    challenges: s.challenges.map((c) => c.title),
    evidenceByConcept: s.agent.evidence.map((e) => ({ concept: e.concept, first: pct(firstRate(e)), latest: pct(latestRate(e)), attempts: e.attempts.map((a) => `${a.kind} ${pct(a.rate)}`) })),
    latestQuizResults: ins ? {
      overall: pct(ins.overallRate), groups: ins.sampleSize,
      questions: ins.stats.map((q) => ({ prompt: q.prompt, concept: q.concept, correct: pct(q.rate), commonWrongAnswer: q.commonWrong })),
    } : null,
    latestChallenge: s.challengeSession?.results.map((r) => ({ concept: r.concept, firstTry: pct(r.rate), easierTry: r.supportRate === undefined ? undefined : pct(r.supportRate) })) ?? null,
    yourRecentDecisions: s.agent.decisions.filter((d) => d.action !== "wait").slice(-6).map((d) => ({
      action: d.action, focus: d.focus, why: d.reason, expected: d.expected, result: d.status, outcome: d.outcome,
    })),
    limits: {
      autoGenerateAllowed: s.settings.autoGenerate, autoPresentAllowed: s.settings.autoPresent,
      videoCooldownSeconds: Math.ceil(cooldownLeftMs / 1000), somethingAlreadyQueued: s.agent.plan?.label ?? null,
      teacherApprovesBeforeAnythingIsShown: s.settings.askFirst,
    },
  };
}

export interface GuardFacts {
  autoGenerate: boolean;
  autoPresent: boolean;
  topicKnown: boolean;
  segments: number;
  busyContent: boolean;
  busyQuiz: boolean;
  busyChallenge: boolean;
  activityRunning: boolean; // something is queued or a quiz/challenge is on the display
  hasUnusedQuiz: boolean;
  cooldownLeftMs: number;
  actsWithoutNews: number;
  repeatsVideoFocus: boolean;
}

/** Returns why a choice is not allowed, or null. These limits are not the model's to change. */
export function permit(c: Choice, trigger: AgentTrigger, f: GuardFacts): string | null {
  if (c.action === "wait" || c.action === "advise_teacher") return null;
  if (!f.autoGenerate) return "the teacher has turned autonomous actions off";
  if (!f.topicKnown) return "the topic is not clear yet";
  if (f.actsWithoutNews >= MAX_ACTS_WITHOUT_NEWS) return "it has acted several times with no new teaching or answers, so it must wait";
  if (c.action === "make_video") {
    if (f.segments < MIN_SEGMENTS) return "too little of the lesson has been heard to write from";
    if (f.busyContent) return "a video is already being made";
    if (trigger === "teaching" && f.cooldownLeftMs > 0) return `the video frequency limit has ${Math.ceil(f.cooldownLeftMs / 1000)} s left`;
    if (f.repeatsVideoFocus) return "a video with this focus was already made";
    return null;
  }
  if (c.action === "prepare_quiz") {
    if (f.busyQuiz) return "a quiz is already being written";
    return f.hasUnusedQuiz ? "an unused quiz is already prepared" : null;
  }
  // The remaining actions all take over the class display.
  if (!f.autoPresent) return "the teacher has turned automatic presentation off";
  if (f.activityRunning) return "another class activity is already queued or running";
  if (c.action === "start_quiz" && f.busyQuiz) return "a quiz is already being written";
  if (c.action === "start_challenge" && f.busyChallenge) return "a challenge is already being written";
  if (c.action === "reexplain" && !c.say) return "no explanation was provided";
  return null;
}

export interface RuleFacts {
  ideaExplained: string | null; // the key idea, once the teacher has covered it
  hasVideo: boolean;
  hasQuiz: boolean;
  weak: string[];
}

/** The offline stand-in. These are fixed rules, and the trace labels them as rules. */
export function decideByRules(trigger: AgentTrigger, f: RuleFacts): Choice {
  const weak = f.weak[0];
  switch (trigger) {
    case "teaching":
      if (f.ideaExplained && !f.hasVideo) return { action: "make_video", reason: `Rule: "${f.ideaExplained}" has been explained and no video exists yet.` };
      break;
    case "content_finished":
      if (!f.hasQuiz) return { action: "prepare_quiz", reason: "Rule: the class has seen a video, so prepare a knowledge check." };
      if (weak) return { action: "start_challenge", focus: weak, reason: `Rule: "${weak}" is still below ${pct(PASS_RATE)} after the follow-up video.` };
      break;
    case "quiz_results":
      if (weak) return { action: "make_video", focus: `Students struggled with ${weak}. Explain it again a different way.`, reason: `Rule: "${weak}" is below ${pct(PASS_RATE)}.` };
      return { action: "advise_teacher", say: "Groups did well on this quiz. It looks safe to move on.", reason: "Rule: no concept is below the pass rate." };
    case "challenge_finished":
      if (weak) return { action: "advise_teacher", say: `"${weak}" is still weak. It may need reteaching in your own words.`, reason: `Rule: "${weak}" stayed below ${pct(PASS_RATE)} after a video and a challenge.` };
      return { action: "advise_teacher", say: "The class handled the challenge well. It looks safe to move on.", reason: "Rule: no concept is below the pass rate." };
  }
  return { action: "wait", reason: "Rule: nothing to do yet." };
}

export const findDecision = (s: ClassroomState, id?: string): AgentDecision | undefined => s.agent.decisions.find((d) => d.id === id);
