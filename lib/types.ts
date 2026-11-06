// Core domain types for the Agentic AI Smart Classroom prototype.

export type AgentName =
  | "Orchestrator"
  | "Listening"
  | "Curriculum"
  | "Content"
  | "Validator"
  | "Voice"
  | "Quiz"
  | "Assessment"
  | "System";

export interface LogEntry {
  id: string;
  t: number;
  agent: AgentName;
  kind: "info" | "decision" | "success" | "warning" | "error";
  message: string;
  detail?: string;
}

export interface TranscriptSegment {
  id: string;
  t: number;
  speaker: "teacher" | "ai";
  text: string;
  addressedToAI?: boolean;
  source?: "mic" | "demo" | "text";
}

export interface LearningObjective {
  code: string;
  text: string;
}

export interface CurriculumRef {
  curriculum: string;
  subject: string;
  level: string;
  unit: string;
  objectives: LearningObjective[];
  source: string;
  verified: boolean; // false = AI-inferred / unverified
  url?: string; // the official document
  next?: string[]; // what follows in the syllabus
}

// ---------- Visual content (storyboards / animations) ----------

export type SceneVisual =
  | { kind: "ladder"; step: number; a?: number; b?: number }
  | { kind: "triangle"; rotation: number; labels: [string, string, string]; highlight?: "hyp" | "right" | "none" }
  | { kind: "emoji"; emoji: string[] }
  | { kind: "photosynthesis"; step: number }
  | { kind: "reel"; headline: string; block: ReelBlock; role: "hook" | "body" | "question" };

// A reel scene's main picture. The script writer picks one block per spoken sentence and the
// toolkit in lib/reel/kit.ts draws it. Blocks are data, so generated text is never run as code.
export type ReelBlock =
  | { type: "headline" }
  | { type: "card"; title: string; body?: string; icon?: string }
  | { type: "stat"; to: number; from?: number; prefix?: string; suffix?: string; dec?: number; label: string }
  | { type: "checklist"; items: string[] }
  | { type: "bars"; data: { label: string; v: number; hi?: boolean }[] }
  | { type: "flow"; items: { icon?: string; label: string }[] }
  | { type: "compare"; left: { title: string; body?: string }; right: { title: string; body?: string }; strikeLeft?: boolean }
  | { type: "formula"; steps: string[] }
  | { type: "triangle"; a: string; b: string; c: string; highlight: "hyp" | "right" | "none" }
  | { type: "fraction"; parts: number; shaded: number; label: string }
  | { type: "objects"; items: { icon: string; label: string }[] }
  | { type: "question"; text: string };

export interface Scene {
  title: string;
  caption: string;
  narration: string;
  formula?: string;
  visual: SceneVisual;
  durationMs: number;
}

export type AssetFormat =
  | "animation"
  | "storyboard"
  | "diagram"
  | "explanation"
  | "story";

export interface GeneratedAsset {
  id: string;
  taskId: string;
  title: string;
  format: AssetFormat;
  topicId: string;
  objectives: LearningObjective[];
  scenes: Scene[];
  isFallback?: boolean;
  createdAt: number;
  validation?: ValidationCheck[];
  presentedAt?: number;
  provider: string;
  reel?: { motif?: string; language: ReelLanguageId; notes?: string };
}

export type TaskStatus =
  | "planned"
  | "generating"
  | "validating"
  | "ready"
  | "presented"
  | "held"
  | "failed"
  | "cancelled";

export interface ValidationCheck {
  name: string;
  status: "pending" | "running" | "pass" | "fail" | "warn";
  detail?: string;
}

export interface GenerationTask {
  id: string;
  kind: "content" | "quiz" | "challenge";
  title: string;
  format: AssetFormat | "quiz" | "challenge";
  reason: string;
  brief: string;
  topicId: string;
  status: TaskStatus;
  stage: string;
  progress: number; // 0..100
  checks: ValidationCheck[];
  createdAt: number;
  updatedAt: number;
  error?: string;
  assetId?: string;
  quizId?: string;
  challengeId?: string;
  focus?: string; // what the agent asked this video to concentrate on
  requestedBy: "agent" | "teacher";
  revisionOf?: string;
  isFallbackFor?: string;
}

// ---------- Quiz & assessment ----------

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number; // index
  concept: string;
  objective?: string;
  explanation: string;
}

export interface Quiz {
  id: string;
  topicId: string;
  title: string;
  questions: QuizQuestion[];
  createdAt: number;
  validated: boolean;
  source?: "lesson" | "dataset"; // lesson = written from what the teacher said
  usedAt?: number;
}

// ---------- Class Challenge: a story problem groups solve together ----------

export interface ChallengeQuestion {
  question: string;
  options: string[];
  answer: number;
}

export interface ChallengeStep extends ChallengeQuestion {
  id: string;
  concept: string;
  situation: string;
  right: string; // shown when most groups got it
  wrong: string; // explains the likely mistake
  support?: ChallengeQuestion; // an easier try, used only if most groups missed the step
}

export interface Challenge {
  id: string;
  topicId: string;
  title: string;
  story: string;
  steps: ChallengeStep[];
  createdAt: number;
  source: "lesson" | "quiz";
}

export interface ChallengeSession {
  challengeId: string;
  groups: string[];
  step: number;
  phase: "answering" | "reveal" | "support" | "supportReveal" | "done";
  responses: Record<string, number | null>; // group -> option, for the question on screen
  lastRate: number;
  results: { stepId: string; concept: string; rate: number; supportRate?: number }[];
}

// ---------- The lesson agent ----------

export type AgentAction = "wait" | "make_video" | "prepare_quiz" | "start_quiz" | "start_challenge" | "reexplain" | "advise_teacher";
export type AgentTrigger = "teaching" | "content_finished" | "quiz_results" | "challenge_finished";

export interface AgentDecision {
  id: string;
  t: number;
  trigger: AgentTrigger;
  action: AgentAction;
  focus?: string;
  say?: string;
  reason: string;
  expected?: string;
  source: "model" | "rules"; // who decided: the language model, or the offline rules
  status: "running" | "done" | "blocked" | "failed" | "skipped";
  outcome?: string;
  reflection?: string; // the agent's own judgement of this action, made at its next decision
}

export interface ConceptEvidence {
  concept: string;
  attempts: { t: number; kind: "quiz" | "challenge"; rate: number; groups: number }[];
}

export type AgentPlan =
  | { kind: "quiz"; id: string; decisionId: string; label: string }
  | { kind: "challenge"; id: string; decisionId: string; label: string }
  | { kind: "explain"; title: string; body: string; decisionId: string; label: string };

export interface PlanStep {
  text: string;
  status: "todo" | "doing" | "done" | "dropped";
}

export interface LessonPlan {
  steps: PlanStep[];
  changes: { t: number; why: string }[]; // why the agent changed course
  updatedAt: number;
}

export interface AgentState {
  thinking: boolean;
  lessonPlan?: LessonPlan;
  snoozedUntil?: number; // the teacher said "later"
  decisions: AgentDecision[];
  evidence: ConceptEvidence[];
  plan?: AgentPlan; // ready, waiting for a natural pause
  advice?: string; // for the teacher only, never shown to the class
  modelDecisions: number;
}

export interface QuizSession {
  quizId: string;
  groups: string[];
  current: number; // current question index shown on display
  responses: Record<string, Record<string, number | null>>; // questionId -> group -> option
  phase: "answering" | "results";
  revealed?: string[]; // questions whose answer has been shown on the display
}

export interface QuestionStat {
  questionId: string;
  prompt: string;
  concept: string;
  responses: number;
  correct: number;
  rate: number;
  distribution: number[];
  flagged: boolean;
  commonWrong?: string;
}

export interface Insights {
  quizId: string;
  sampleSize: number;
  overallRate: number;
  stats: QuestionStat[];
  weakConcepts: string[];
  recommendation: string;
  followUp?: { title: string; conceptKey: string };
  caveat: string;
  generatedAt: number;
}

// ---------- Lesson context ----------

export interface LessonContext {
  subject: string | null;
  topicId: string | null;
  topic: string | null;
  level: string | null;
  confidence: number; // 0..1
  status: "listening" | "uncertain" | "general" | "confident";
  concepts: string[];
  keywords: string[];
  summary: string[];
  scores: Record<string, number>;
  topicHistory: { t: number; topic: string }[];
  source: "dataset" | "llm" | "syllabus" | "none";
}

export type PresentationMode = "idle" | "content" | "quiz" | "results" | "explanation" | "challenge";

export interface Presentation {
  mode: PresentationMode;
  assetId?: string;
  scene: number;
  playing: boolean;
  sceneStartedAt: number;
  explanation?: { title: string; body: string; emoji?: string };
  waitingAssetId?: string; // ready, waiting for a natural pause
}

export type ReelStyleId = "paper" | "storybook" | "blueprint" | "poster" | "neon";
export type ReelLanguageId = "en" | "ms-formal" | "ms-casual" | "mixed";

// What the teacher may configure. The script itself is deliberately absent: it is always
// written automatically from what the Listening agent heard.
export interface ReelConfig {
  style: ReelStyleId;
  language: ReelLanguageId;
  lengthSec: number;
  captions: boolean;
  voice: string; // browser voice name; "" = pick automatically for the language
}

export type Patience = "quick" | "normal" | "patient";

export interface Settings {
  reel: ReelConfig;
  autoGenerate: boolean;
  autoPresent: boolean;
  askFirst: boolean; // nothing reaches the class until the teacher says so
  classYear: number | null; // Tahun 1 to 6, or null to work it out from the lesson
  patience: Patience;
  voiceOutput: boolean;
  narration: boolean;
  failureMode: "none" | "generation" | "validation";
  pauseThresholdMs: number;
  cooldownMs: number;
}

export interface ChatTurn {
  role: "teacher" | "ai";
  text: string;
}

export interface Conversation {
  turns: ChatTurn[]; // recent back-and-forth, so "explain that again" has a referent
  thinking: boolean; // waiting for the first words of a reply
  listeningUntil: number; // until this time, a reply needs no wake phrase (0 = closed)
}

export type ListeningStatus = "off" | "listening" | "paused" | "denied" | "unsupported";

export interface ClassroomState {
  lesson: {
    id: string | null;
    status: "idle" | "live" | "ended";
    startedAt: number | null;
    endedAt: number | null;
  };
  listening: ListeningStatus;
  lastTeacherSpeechAt: number;
  interim: string;
  transcript: TranscriptSegment[];
  context: LessonContext;
  curriculum: CurriculumRef | null;
  tasks: GenerationTask[];
  assets: GeneratedAsset[];
  quizzes: Quiz[];
  quizSession: QuizSession | null;
  insights: Insights | null;
  challenges: Challenge[];
  challengeSession: ChallengeSession | null;
  agent: AgentState;
  presentation: Presentation;
  log: LogEntry[];
  settings: Settings;
  voice: { speaking: boolean; queue: number; last?: string };
  conversation: Conversation;
  demo: { running: boolean; script: string | null; index: number; total: number };
  aiProvider: { llm: boolean; model?: string; engine?: "api" | "claude-code" };
  teacherActions: { t: number; action: string; ref?: string }[];
}
