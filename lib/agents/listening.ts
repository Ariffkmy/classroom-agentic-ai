// Listening Agent: turns transcript segments into lesson-context signals.
// Permitted: transcribe authorised speech, summarise, identify concepts.
// Restricted: identifying students, inferring emotions (never implemented).

import { TOPICS, type TopicEntry } from "../curriculum";

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");

export function scoreSegment(text: string): Record<string, number> {
  const t = norm(text);
  const scores: Record<string, number> = {};
  for (const topic of TOPICS) {
    let s = 0;
    for (const [kw, w] of Object.entries(topic.keywords)) {
      const re = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "g");
      const n = (t.match(re) || []).length;
      s += Math.min(n, 2) * w;
    }
    if (s > 0) scores[topic.id] = s;
  }
  return scores;
}

export function extractConcepts(text: string, topic: TopicEntry | undefined): string[] {
  if (!topic) return [];
  const t = norm(text);
  const out: string[] = [];
  for (const [trigger, label] of Object.entries(topic.concepts)) {
    if (t.includes(trigger) && !out.includes(label)) out.push(label);
  }
  return out;
}

export function extractKeywords(text: string): string[] {
  const t = norm(text);
  const found: string[] = [];
  for (const topic of TOPICS) {
    for (const kw of Object.keys(topic.keywords)) {
      if (t.includes(kw) && !found.includes(kw)) found.push(kw);
    }
  }
  return found;
}

/** Combine decayed running scores into a classification. */
export function classify(scores: Record<string, number>) {
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { topicId: null as string | null, confidence: 0, top: 0 };
  const [topId, top] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  // Confidence grows with absolute evidence and margin over the runner-up.
  const evidence = 1 - Math.exp(-top / 7);
  const margin = top / (top + second + 0.5);
  const confidence = Math.max(0, Math.min(0.99, evidence * margin));
  return { topicId: topId, confidence, top };
}

// ---------- Direct address & spoken commands ----------

const WAKE = /\b(hey|hi|ok|okay)?,?\s*(assistant|classroom ai|teaching assistant)\b|^\s*(hey\s+)?(ai|a\.i\.)\b[,\s]/i;

export function isAddressedToAI(text: string) {
  return WAKE.test(text);
}

export type Intent =
  | { type: "simpler" }
  | { type: "example" }
  | { type: "animation"; different: boolean }
  | { type: "quiz"; count: number }
  | { type: "stop" }
  | { type: "summary" }
  | { type: "question"; text: string };

const NUMS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

export function parseIntent(raw: string): Intent {
  const t = norm(raw);
  if (/\b(stop|cancel|dismiss|that's enough|be quiet)\b/.test(t)) return { type: "stop" };
  if (/\b(quiz|questions?)\b/.test(t) && /\b(prepare|make|create|give|generate|set|quiz)\b/.test(t)) {
    const m = t.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b\s+(quiz\s+)?questions?/);
    const count = m ? Number(m[1]) || NUMS[m[1]] || 5 : 5;
    return { type: "quiz", count };
  }
  if (/\b(animation|animate|video|visual|show the class|diagram)\b/.test(t))
    return { type: "animation", different: /\b(different|another|new|other)\b/.test(t) };
  if (/\b(simpler|simple language|easier|simplify|more simply)\b/.test(t)) return { type: "simpler" };
  if (/\b(example|real[- ]life|everyday|real world)\b/.test(t)) return { type: "example" };
  if (/\b(summary|summari[sz]e|recap)\b/.test(t)) return { type: "summary" };
  return { type: "question", text: raw.replace(WAKE, "").trim() };
}
