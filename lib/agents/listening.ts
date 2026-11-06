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

// Speech recognition often mishears "hey assistant", so the common slips count too. Words like
// "sister" need the "hey" in front, or a lesson mentioning someone's sister would wake the AI.
const WAKE = /\b(hey|hi|ok|okay)?,?\s*(assistant|classroom ai|teaching assistant)\b|^\s*(hey\s+)?(ai|a\.i\.)\b[,\s]|\b(hey|hi|hello|ok|okay)[,\s]+(a\s+)?(sister|system|assistance|assistants)\b|^\s*(a system|assistance|assistants)\b/i;

export function isAddressedToAI(text: string) {
  return WAKE.test(text);
}

const WORDS_FOLLOW_UP = 14;
const FOLLOW_UP = /^(why|how|what|when|where|who|which|whose|can|could|would|should|is|are|does|do you|did|really|explain|tell|show|give|say|repeat|again|more|another|sorry|pardon|i don'?t|kenapa|mengapa|bagaimana|macam mana|apa|boleh|cuba|terangkan|lagi|maaf)\b/i;
const CLOSING = /^(ok(ay)?[, ]*)?(thanks|thank you|terima kasih|that'?s all|that is all|no thanks|got it|good|great|perfect|cool|nice|alright|all right|baik|bagus)\b/i;

/**
 * Sorts what the teacher said just after an AI reply. Without a wake phrase the only clues are
 * the wording and the length: teaching tends to be statements, and to run longer.
 */
export function classifyReply(text: string): "followup" | "close" | "teaching" {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words <= 6 && CLOSING.test(t)) return "close";
  if (t.endsWith("?")) return "followup";
  // Speech recognition rarely adds a question mark, and people lead in with "so" or "okay".
  const lead = t.replace(/^(so|and|but|okay|ok|then|right|hmm|um)[,\s]+/i, "");
  return words <= WORDS_FOLLOW_UP && FOLLOW_UP.test(lead) ? "followup" : "teaching";
}

export const withoutWake = (raw: string) => raw.replace(WAKE, "").replace(/^[\s,.:;!-]+/, "").trim() || raw.trim();

// ---------- Spoken control of a quiz or challenge on the display ----------

export type ActivityCommand =
  | { type: "answer"; group: string | null; option: number } // group null = the class as a whole
  | { type: "check" }
  | { type: "next" }
  | { type: "finish" };

const SPOKEN_LETTER: Record<string, string> = { a: "a", ay: "a", eh: "a", b: "b", bee: "b", be: "b", c: "c", see: "c", sea: "c", d: "d", dee: "d" };
const LETTER = Object.keys(SPOKEN_LETTER).join("|");
const GROUP_LETTER = `${LETTER}|e|f`;
const option = (word: string) => "abcd".indexOf(SPOKEN_LETTER[word]);

const ANSWER_GROUP = new RegExp(`\\b(?:group|kumpulan)\\s+(${GROUP_LETTER})\\b[\\s,:-]*(?:[\\p{L}']+\\s+){0,3}?(${LETTER})$`, "iu");
const ANSWER_CLASS = new RegExp(`\\b(?:they|everyone|everybody|all|class|groups?|most|students?|we|semua|mereka)\\b.*\\b(?:answer\\w*|say\\w*|said|chose|choose|choosing|pick\\w*|are|is|hold\\w*|went|go\\w*|jawab\\w*|pilih\\w*)\\b\\s+(?:with\\s+|for\\s+|option\\s+|letter\\s+|answer\\s+)*(${LETTER})$`, "iu");
const ANSWER_ALONE = new RegExp(`^(?:the\\s+)?(?:answer(?:\\s+is)?|option|letter|jawapan)?\\s*(${LETTER})$`, "iu");

/**
 * Reads what the teacher says while a quiz or challenge is up. A letter only counts at the end of
 * a sentence, so that "this is a triangle" is not taken as answer A.
 */
export function parseActivitySpeech(raw: string): ActivityCommand | null {
  const t = norm(withoutWake(raw)).toLowerCase().replace(/[.,!?]+/g, " ").replace(/\s+/g, " ").trim();
  const words = t.split(" ").length;
  const group = t.match(ANSWER_GROUP);
  if (group) return { type: "answer", group: `Group ${SPOKEN_LETTER[group[1]]?.toUpperCase() ?? group[1].toUpperCase()}`, option: option(group[2]) };
  const whole = t.match(ANSWER_CLASS) ?? t.match(ANSWER_ALONE);
  if (whole) return { type: "answer", group: null, option: option(whole[1]) };
  if (words > 8) return null;
  if (/\b(show|see)\b.*\bresults?\b|\b(finish|end|stop)\b.*\b(quiz|challenge)\b|\b(analyse|analyze)\b|\bkeputusan\b/.test(t)) return { type: "finish" };
  if (/\b(is|was) (that|it|this) (correct|right)\b|^(correct|right)$|\b(what|which) is the (right |correct )?answer\b|\bshow the answer\b|\breveal\b|\bbetul\b/.test(t)) return { type: "check" };
  if (/\bnext\b|\bcontinue\b|\bcarry on\b|\bmove on\b|\bseterusnya\b/.test(t)) return { type: "next" };
  return null;
}

// ---------- Reading the teacher, so the AI doesn't step on an explanation ----------

export const THINKING_TIME_MS = 12000; // extra quiet time after a question or an unfinished thought

/** True when silence is deliberate: the teacher asked the class something or stopped mid-idea. */
export function teacherMidThought(text: string) {
  const raw = text.trim();
  const t = raw.toLowerCase().replace(/[.…,\s]+$/, "");
  if (raw.endsWith("?")) return true;
  if (/\b(and|so|but|because|then|or|which|that|the|a|an|dan|sebab|kerana|tetapi|jadi)$/.test(t)) return true;
  return /^(?:(?:so|okay|ok|now|class|right|alright)[,\s]+)*(?:what|why|how|who|which|can anyone|can you|does anyone|do you|anyone|siapa|apa|kenapa|bagaimana|boleh)\b/.test(t);
}

export type ReadyCommand = "show" | "later" | "skip";

/** Short replies to something waiting on the teacher. They must be nearly the whole sentence. */
export function parseReadySpeech(raw: string): ReadyCommand | null {
  const t = norm(withoutWake(raw)).toLowerCase().replace(/[.,!?]+/g, " ").replace(/\s+/g, " ").trim();
  const lead = "(?:okay |ok |yes |yeah |alright |sure |baik )*";
  if (new RegExp(`^${lead}(?:show it|show that|show them|show now|go ahead|start it|start now|play it|yes please|tunjuk|tunjukkan|mulakan)(?: now| please| sekarang)?$`).test(t)) return "show";
  if (/^(?:okay |ok )?(?:not now|later|wait|hold on|nanti|sekejap|tunggu)(?: please| first| a bit| a while| dulu)?$/.test(t)) return "later";
  if (/^(?:okay |ok )?(?:skip it|skip|cancel it|cancel|no thanks|never mind|tak payah|batal)$/.test(t)) return "skip";
  return null;
}

export type Intent =
  | { type: "pause" }
  | { type: "resume" }
  | { type: "simpler" }
  | { type: "example" }
  | { type: "animation"; different: boolean }
  | { type: "quiz"; count: number }
  | { type: "challenge" }
  | { type: "stop" }
  | { type: "summary" }
  | { type: "question"; text: string };

const NUMS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

export function parseIntent(raw: string): Intent {
  const t = norm(raw);
  if (/\b(stop|cancel|dismiss|that's enough|be quiet)\b/.test(t)) return { type: "stop" };
  const short = t.trim().split(" ").length <= 6;
  if (short && /\b(wait|hold on|pause|tunggu)\b/.test(t)) return { type: "pause" };
  if (short && /\b(resume|continue|carry on|sambung)\b/.test(t)) return { type: "resume" };
  if (/\b(challenge|story problem|cabaran)\b/.test(t)) return { type: "challenge" };
  if (/\b(quiz|questions?|kuiz|soalan)\b/.test(t) && /\b(prepare|make|create|give|generate|set|quiz|sediakan|buat|bina|beri|berikan|kuiz)\b/.test(t)) {
    const m = t.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b\s+(quiz\s+)?questions?/);
    const count = m ? Number(m[1]) || NUMS[m[1]] || 5 : 5;
    return { type: "quiz", count };
  }
  if (/\b(animation|animate|video|visual|show the class|diagram)\b/.test(t))
    return { type: "animation", different: /\b(different|another|new|other)\b/.test(t) };
  if (/\b(simpler|simple language|easier|simplify|more simply)\b/.test(t)) return { type: "simpler" };
  if (/\b(example|real[- ]life|everyday|real world|contoh)\b/.test(t)) return { type: "example" };
  if (/\b(summary|summari[sz]e|recap)\b/.test(t)) return { type: "summary" };
  return { type: "question", text: withoutWake(raw) };
}
