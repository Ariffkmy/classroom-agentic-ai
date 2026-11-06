// On-device script writer, used when no language model is reachable. It builds the plan from
// the teacher's own sentences, so an offline video still comes from what was heard in class.
// It cannot translate or paraphrase: only the opening and closing lines follow the language setting.

import type { ReelBlock, ReelLanguageId } from "../types";
import { countWords, type ReelInput, type ReelPlan, type ReelRow } from "./plan";

const MANAGEMENT = /\b(good morning|good afternoon|phones?|sit down|be quiet|settle down|open your books?|look at the board|take out|attendance|homework|okay class|today we are going to)\b/i;
const STOPWORDS = new Set("a an and are as at be because but by can do does even every for from get go going has have here how if in into is it its just let let's like look long me more most my need no not now of on one only or our out over put say see so some special that the their them then there these they this those time to too up us use very was we what when where which who why will with you your".split(" "));

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, "twenty-five": 25,
  "twenty five": 25, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};
const NUMBER_WORD = Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length).join("|");
const toNumber = (w: string) => (/^\d/.test(w) ? Number(w) : WORD_NUMBERS[w.toLowerCase()]);

const ICONS: [RegExp, string][] = [
  [/\b(triangle|angle|hypotenuse|shape)\b/i, "📐"], [/\b(square|formula|equation|equals|plus|minus)\b/i, "➗"],
  [/\b(sun|sunlight|light|energy)\b/i, "☀️"], [/\b(leaf|leaves|plant|chlorophyll|green)\b/i, "🌿"], [/\b(water|rain|roots?)\b/i, "💧"],
  [/\b(air|oxygen|carbon|gas|breathe)\b/i, "🫧"], [/\b(food|sugar|glucose|eat|pizza|cake)\b/i, "🍕"], [/\b(building|roof|wall|ladder)\b/i, "🏠"],
  [/\b(money|price|cost|ringgit|rm)\b/i, "💰"], [/\b(discover|history|long time ago|ancient)\b/i, "📜"], [/\b(fraction|half|quarter|share|equal parts?)\b/i, "🧩"],
];
const iconFor = (text: string, fallback = "💡") => ICONS.find(([re]) => re.test(text))?.[1] ?? fallback;

const LINES: Record<ReelLanguageId, { hook: (t: string) => [string, string]; close: (c: string) => string; ask: (c: string) => string }> = {
  en: {
    hook: (t) => [`Let's look at ${t} again.`, `Let's look at *${t}* again`],
    close: (c) => `Your turn. In your group, how would you explain ${c} in your own words?`,
    ask: (c) => `How would you explain ${c} in your own words?`,
  },
  "ms-formal": {
    hook: (t) => [`Mari kita lihat semula ${t}.`, `Mari kita lihat semula *${t}*`],
    close: (c) => `Giliran anda. Dalam kumpulan, bagaimanakah anda menerangkan ${c} dengan perkataan sendiri?`,
    ask: (c) => `Bagaimanakah anda menerangkan ${c} dengan perkataan sendiri?`,
  },
  "ms-casual": {
    hook: (t) => [`Jom kita tengok semula ${t}.`, `Jom tengok semula *${t}*`],
    close: (c) => `Giliran korang. Dalam kumpulan, macam mana korang nak terangkan ${c} guna ayat sendiri?`,
    ask: (c) => `Macam mana nak terangkan ${c} guna ayat sendiri?`,
  },
  mixed: {
    hook: (t) => [`Jom kita look at ${t} again.`, `Jom look at *${t}* again`],
    close: (c) => `Your turn. Dalam group, macam mana you all nak explain ${c}?`,
    ask: (c) => `Macam mana nak explain ${c}?`,
  },
};

/** Speech recognition often has no punctuation, so long runs are split as well. */
function toSentences(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    for (const part of line.split(/(?<=[.!?])\s+/)) {
      const words = part.trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i += 26) out.push(words.slice(i, i + 26).join(" "));
    }
  }
  return out
    .map((s) => s.replace(/^(so|okay|ok|now|well|alright|right)[,\s]+/i, "").trim())
    .filter((s) => countWords(s) >= 4)
    .map((s) => s[0].toUpperCase() + s.slice(1));
}

const hasMath = (s: string) => new RegExp(`\\b(\\w+) squared\\b|\\b(${NUMBER_WORD}|\\d+) (plus|minus|times) (${NUMBER_WORD}|\\d+)\\b|\\bsquare root of\\b`, "i").test(s);

function score(s: string, input: ReelInput, focusWords: string[]) {
  const low = s.toLowerCase();
  if (MANAGEMENT.test(low)) return -10;
  let n = 0;
  for (const k of [...input.keywords, ...input.topic.toLowerCase().split(/\s+/)]) if (k.length > 2 && low.includes(k.toLowerCase())) n += 2;
  for (const c of input.concepts) for (const w of c.toLowerCase().split(/\W+/)) if (w.length > 3 && low.includes(w)) n += 1;
  if (/\d|\b(equals|because|means|called)\b/.test(low)) n += 2;
  if (hasMath(low)) n += 3;
  for (const w of focusWords) if (low.includes(w)) n += 6;
  return n;
}

const contentWords = (s: string) => s.replace(/[.,!?;:—]/g, "").split(/\s+/).filter((w) => !STOPWORDS.has(w.toLowerCase()) && w.length > 2);

/** The sentence's own opening, so a headline still reads as words someone would say. */
function headlineFor(s: string): string {
  const opening = s.replace(/[.,!?;:—]/g, "").split(/\s+/).slice(0, 6);
  while (opening.length > 2 && STOPWORDS.has(opening[opening.length - 1].toLowerCase())) opening.pop();
  const lead = opening.filter((w) => !STOPWORDS.has(w.toLowerCase())).reduce((best, w) => (w.length > best.length ? w : best), "");
  return opening.map((w) => (w === lead ? `*${w}*` : w)).join(" ");
}

/** Short labels for diagrams. */
const keyWords = (s: string) => {
  const words = contentWords(s);
  return (words.length ? words : s.split(/\s+/)).slice(0, 3).join(" ");
};

/** Everyday things named in the sentence, each paired with the word that named it. */
function namedObjects(s: string) {
  const seen = new Set<string>();
  const out: { icon: string; label: string }[] = [];
  for (const [re, icon] of ICONS) {
    const hit = s.match(re);
    if (hit && !seen.has(icon)) {
      seen.add(icon);
      out.push({ icon, label: hit[0].toLowerCase() });
    }
  }
  return out.slice(0, 4);
}

function formulaSteps(s: string): string[] | null {
  const low = s.toLowerCase().replace(/[.,!?]/g, "");
  const sym = low.match(/\b(\w) squared plus (\w) squared equals (\w) squared\b/);
  if (sym) return [`${sym[1]}² + ${sym[2]}² = ${sym[3]}²`];
  const steps: string[] = [];
  const nW = `(${NUMBER_WORD}|\\d+)`;
  for (const m of low.matchAll(new RegExp(`\\b${nW} squared is ${nW}\\b`, "g"))) steps.push(`${toNumber(m[1])}² = ${toNumber(m[2])}`);
  for (const m of low.matchAll(new RegExp(`\\b${nW} (plus|minus|times) ${nW} (?:is|equals) ${nW}\\b`, "g"))) {
    const op = { plus: "+", minus: "−", times: "×" }[m[2]];
    steps.push(`${toNumber(m[1])} ${op} ${toNumber(m[3])} = ${toNumber(m[4])}`);
  }
  for (const m of low.matchAll(new RegExp(`\\bsquare root of ${nW} is ${nW}\\b`, "g"))) steps.push(`√${toNumber(m[1])} = ${toNumber(m[2])}`);
  return steps.length ? steps.slice(0, 4) : null;
}

function chooseBlock(s: string): ReelBlock {
  const steps = formulaSteps(s);
  if (steps) return { type: "formula", steps };
  const low = s.toLowerCase();
  if (/\b(right[- ]angled?|hypotenuse|longest side)\b/.test(low)) return { type: "triangle", a: "a", b: "b", c: "c", highlight: /hypotenuse|longest side/.test(low) ? "hyp" : "right" };

  const frac = low.match(/\b(\d+|one|two|three|four|five|six|seven) (?:over|out of) (\d+|two|three|four|five|six|seven|eight|nine|ten|twelve)\b/);
  if (frac) {
    const [shaded, parts] = [toNumber(frac[1]), toNumber(frac[2])];
    if (parts >= 2 && parts <= 12 && shaded <= parts) return { type: "fraction", parts, shaded, label: frac[0] };
  }
  if (/\bhalf\b/.test(low)) return { type: "fraction", parts: 2, shaded: 1, label: "one half" };
  if (/\bquarter\b/.test(low)) return { type: "fraction", parts: 4, shaded: 1, label: "one quarter" };

  const clauses = s.split(/\b(?:into|becomes?|turns? into|produces?|makes?|then)\b/i).map(keyWords).filter(Boolean);
  if (clauses.length >= 2 && clauses.length <= 4) return { type: "flow", items: clauses.map((c) => ({ label: c.slice(0, 30), icon: iconFor(c, "▶️") })) };

  const parts = s.replace(/[.!?]$/, "").split(/,\s*|\s+and\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3 && parts.every((p) => countWords(p) <= 7)) return { type: "checklist", items: parts.slice(0, 5).map((p) => p.slice(0, 56)) };

  const number = s.match(/\b(\d+(?:\.\d+)?)\s*(%|cm|km|m|kg|percent)?\b/);
  if (number) return { type: "stat", to: Number(number[1]), suffix: number[2] ? ` ${number[2]}` : "", label: keyWords(s) };

  const objects = namedObjects(s);
  if (objects.length) return { type: "objects", items: objects };
  return { type: "card", title: keyWords(s), icon: iconFor(s) };
}

const speakable = (concept: string, topic: string) => (/^[\p{L}\p{N}\s'’-]+$/u.test(concept) ? concept.toLowerCase() : topic);

/** Returns null when too little of the lesson has been heard to write an honest script. */
export function composeOffline(input: ReelInput, language: ReelLanguageId): ReelPlan | null {
  const sentences = toSentences(input.sentences);
  const focusWords = (input.focus ?? "").toLowerCase().split(/\W+/).filter((w) => w.length > 4 && !STOPWORDS.has(w));
  const ranked = sentences.map((s, i) => ({ s, i, n: score(s, input, focusWords) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.i - b.i);
  // A different version starts from the sentences the first version was least likely to use.
  const pool = input.variant ? [...ranked.filter((_, i) => i % 2 === 1), ...ranked.filter((_, i) => i % 2 === 0)] : ranked;

  const picked: typeof ranked = [];
  let budget = input.wordsTarget - 20; // the fixed opening and closing lines take about 20 words
  for (const x of pool) {
    if (picked.length >= 6 || budget <= 0) break;
    picked.push(x);
    budget -= countWords(x.s);
  }
  if (picked.length < 2) return null;
  picked.sort((a, b) => a.i - b.i);

  const lines = LINES[language];
  const [spoken, text] = lines.hook(input.topic);
  const concept = speakable(input.concepts[input.concepts.length - 1] ?? input.topic, input.topic);
  const rows: ReelRow[] = [
    { spoken, text, block: { type: "headline" } },
    ...picked.map((x) => ({ spoken: x.s, text: headlineFor(x.s), block: chooseBlock(x.s) })),
    { spoken: lines.close(concept), text: `*${input.topic}*`, block: { type: "question", text: lines.ask(concept) } },
  ];
  return {
    title: `${input.topic}: from today's lesson`,
    motif: iconFor(`${input.topic} ${input.sentences.join(" ")}`, "💡"),
    rows,
    notes: language === "en" ? undefined : "Offline mode keeps the teacher's sentences in the language they were spoken.",
  };
}
