// Quiz questions and Class Challenges. Model output arrives here as untrusted input: anything
// malformed is dropped rather than repaired, and text only ever reaches the page as text.

import type { Challenge, ChallengeQuestion, ChallengeStep, Quiz, QuizQuestion, ValidationCheck } from "../types";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const rec = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const conceptKey = (v: unknown) => str(v, 40).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "key-idea";

function question(raw: Record<string, unknown>, text: unknown): ChallengeQuestion | null {
  const options = list(raw.options, 4).map((o) => str(o, 90)).filter(Boolean);
  const answer = Number(raw.answer);
  const prompt = str(text, 220);
  if (!prompt || options.length < 2 || new Set(options).size !== options.length) return null;
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;
  return { question: prompt, options, answer };
}

export function sanitizeQuestions(raw: unknown, count: number, objective?: string): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const item of list(rec(raw).questions, count)) {
    const r = rec(item);
    const q = question(r, r.prompt);
    if (q) out.push({ id: `q${out.length + 1}`, prompt: q.question, options: q.options, answer: q.answer, concept: conceptKey(r.concept), objective, explanation: str(r.explanation, 260) });
  }
  return out;
}

export function sanitizeChallenge(raw: unknown, id: string, topicId: string): Challenge | null {
  const r = rec(raw);
  const steps: ChallengeStep[] = [];
  for (const item of list(r.steps, 3)) {
    const s = rec(item);
    const q = question(s, s.question);
    const situation = str(s.situation, 240);
    if (!q || !situation) continue;
    const sup = rec(s.support);
    steps.push({
      ...q, id: `s${steps.length + 1}`, concept: conceptKey(s.concept), situation,
      right: str(s.right, 220) || "Well done. That is right.",
      wrong: str(s.wrong, 240) || "Not quite. Let's look at that again.",
      support: question(sup, sup.question) ?? undefined,
    });
  }
  const story = str(r.story, 300);
  if (!steps.length || !story) return null;
  return { id, topicId, title: str(r.title, 70) || "Class Challenge", story, steps, createdAt: Date.now(), source: "lesson" };
}

/** Offline version: puts existing quiz questions into a challenge, weakest concepts first. */
export function challengeFromQuiz(quiz: Quiz, id: string, topic: string, weak: string[]): Challenge | null {
  const ordered = [...quiz.questions].sort((a, b) => Number(weak.includes(b.concept)) - Number(weak.includes(a.concept)));
  const steps = ordered.slice(0, 3).map((q, i): ChallengeStep => ({
    id: `s${i + 1}`, concept: q.concept, situation: `Challenge ${i + 1}: talk it through as a group first.`,
    question: q.prompt, options: q.options, answer: q.answer,
    right: q.explanation || "Well done. That is right.",
    wrong: q.explanation || "Not quite. Let's look at that again.",
  }));
  if (!steps.length) return null;
  return { id, topicId: quiz.topicId, title: `${topic} challenge`, story: `Let's put ${topic} to work. Each group solves these together.`, steps, createdAt: Date.now(), source: "quiz" };
}

export const quizText = (questions: QuizQuestion[]) =>
  questions.map((q, i) => `Q${i + 1}. ${q.prompt}\nOptions: ${q.options.join(" | ")}\nKeyed answer: ${q.options[q.answer]}\nExplanation: ${q.explanation}`).join("\n\n");

export const challengeText = (c: Challenge) =>
  [c.story, ...c.steps.map((s, i) => [
    `Step ${i + 1}. ${s.situation} ${s.question}`, `Options: ${s.options.join(" | ")}`, `Keyed answer: ${s.options[s.answer]}`,
    `If right: ${s.right}`, `If wrong: ${s.wrong}`,
    s.support ? `Easier try: ${s.support.question} Options: ${s.support.options.join(" | ")}. Keyed answer: ${s.support.options[s.support.answer]}` : "",
  ].filter(Boolean).join("\n"))].join("\n\n");

export function validateChallenge(c: Challenge, unsafe: (text: string) => boolean, accuracy: ValidationCheck): ValidationCheck[] {
  return [
    { name: "Answer key integrity", status: "pass", detail: `${c.steps.length} steps, each with one keyed answer` },
    { name: "Safety & bias", status: unsafe(challengeText(c)) ? "fail" : "pass" },
    accuracy,
  ];
}
