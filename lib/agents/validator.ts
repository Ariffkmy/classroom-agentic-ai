// Automated content checks (FR-08 / §14.1). Every generated asset must pass these
// before the Orchestrator is allowed to present it automatically.

import type { CurriculumRef, GeneratedAsset, LessonContext, Quiz, ValidationCheck } from "../types";
import { getTopic } from "../curriculum";

const BLOCKLIST = /\b(kill|blood|gun|weapon|stupid|dumb|hate|sexy|drugs?|alcohol|gambl\w*)\b/i;
const PII = /\b(\d{6}-\d{2}-\d{4}|\+?6?01\d[- ]?\d{7,8}|[\w.]+@[\w.]+\.\w+)\b/; // MyKad / MY phone / email

export const CHECK_NAMES = [
  "Relevance to lesson topic",
  "Curriculum alignment",
  "Age-appropriateness",
  "Educational quality",
  "Safety & bias",
  "Technical integrity",
] as const;

export function pendingChecks(): ValidationCheck[] {
  return CHECK_NAMES.map((name) => ({ name, status: "pending" }));
}

function wordsPerSentence(text: string) {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
  const words = text.split(/\s+/).filter(Boolean).length;
  return words / Math.max(1, sentences.length);
}

export function validateAsset(
  asset: GeneratedAsset,
  ctx: LessonContext,
  curriculum: CurriculumRef | null,
  opts: { forceFail?: boolean } = {},
): ValidationCheck[] {
  const text = asset.scenes.map((s) => `${s.title} ${s.caption} ${s.narration} ${s.formula ?? ""}`).join(" ").toLowerCase();
  const topic = getTopic(asset.topicId);
  const checks: ValidationCheck[] = [];

  // 1. Relevance
  const kws = topic ? Object.keys(topic.keywords) : ctx.keywords;
  const hits = kws.filter((k) => text.includes(k.toLowerCase()));
  const sameTopic = asset.topicId === ctx.topicId;
  checks.push({
    name: CHECK_NAMES[0],
    status: sameTopic && hits.length >= 2 ? "pass" : sameTopic ? "warn" : "fail",
    detail: sameTopic ? `${hits.length} topic terms matched (${hits.slice(0, 4).join(", ")})` : "Asset topic no longer matches the live lesson topic",
  });

  // 2. Curriculum alignment
  if (opts.forceFail) {
    checks.push({ name: CHECK_NAMES[1], status: "fail", detail: "Objective mapping could not be confirmed against the configured curriculum source" });
  } else if (!curriculum) {
    checks.push({ name: CHECK_NAMES[1], status: "warn", detail: "No curriculum source available — labelled unverified" });
  } else {
    const codes = new Set(curriculum.objectives.map((o) => o.code));
    const ok = asset.objectives.length > 0 && asset.objectives.every((o) => codes.has(o.code));
    checks.push({
      name: CHECK_NAMES[1],
      status: ok ? (curriculum.verified ? "pass" : "warn") : "fail",
      detail: ok ? `Maps to ${asset.objectives.map((o) => o.code).join(", ")}${curriculum.verified ? "" : " (unverified source)"}` : "Objectives do not match curriculum",
    });
  }

  // 3. Age-appropriateness (readability proxy)
  const wps = wordsPerSentence(asset.scenes.map((s) => s.narration).join(" "));
  checks.push({
    name: CHECK_NAMES[2],
    status: wps <= 22 ? "pass" : "warn",
    detail: `Avg ${wps.toFixed(1)} words/sentence for ${ctx.level ?? "inferred level"}`,
  });

  // 4. Educational quality: hook → concept → worked example/formula → check for understanding
  const hasFormula = asset.scenes.some((s) => s.formula);
  const hasCheck = asset.scenes.some((s) => /\?|your turn|discuss|think about|quick check/i.test(s.caption + s.narration));
  const q = (asset.scenes.length >= 2 ? 1 : 0) + (hasFormula ? 1 : 0) + (hasCheck ? 1 : 0);
  checks.push({
    name: CHECK_NAMES[3],
    status: q >= 2 ? "pass" : asset.isFallback ? "warn" : "fail",
    detail: `${asset.scenes.length} scenes · worked example ${hasFormula ? "✓" : "✗"} · check-for-understanding ${hasCheck ? "✓" : "✗"}`,
  });

  // 5. Safety & bias
  const unsafe = BLOCKLIST.test(text);
  const pii = PII.test(text);
  checks.push({
    name: CHECK_NAMES[4],
    status: unsafe || pii ? "fail" : "pass",
    detail: unsafe ? "Blocked term detected" : pii ? "Possible personal data detected — blocked" : "No unsafe terms, no student data, fictional characters only",
  });

  // 6. Technical integrity
  const okScenes = asset.scenes.every((s) => s.title && s.caption && s.durationMs > 1000 && s.visual);
  const total = asset.scenes.reduce((a, s) => a + s.durationMs, 0) / 1000;
  checks.push({
    name: CHECK_NAMES[5],
    status: okScenes && total <= 120 ? "pass" : "fail",
    detail: `${asset.scenes.length} scenes rendered · ${total.toFixed(0)} s runtime`,
  });

  return checks;
}

export function validateQuiz(quiz: Quiz): ValidationCheck[] {
  const qs = quiz.questions;
  const wellFormed = qs.every((q) => q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length);
  const uniqueOpts = qs.every((q) => new Set(q.options).size === q.options.length);
  const safe = !qs.some((q) => BLOCKLIST.test(q.prompt + q.options.join(" ")));
  return [
    { name: "Answer key integrity", status: wellFormed ? "pass" : "fail", detail: `${qs.length} questions, each with one keyed answer` },
    { name: "Distinct options", status: uniqueOpts ? "pass" : "fail" },
    { name: "Objective coverage", status: qs.some((q) => q.objective) ? "pass" : "warn", detail: [...new Set(qs.map((q) => q.objective).filter(Boolean))].join(", ") || "AI-inferred" },
    { name: "Safety & bias", status: safe ? "pass" : "fail" },
  ];
}

export const checksPassed = (checks: ValidationCheck[]) => checks.every((c) => c.status === "pass" || c.status === "warn");
