// Accuracy checks. This file holds the part that needs no model: it recomputes any plain
// arithmetic it can find, so a wrong sum is caught even offline. A model review (task "review")
// covers facts and reasoning on top of this.

import type { Scene } from "../types";

const SUPER: Record<string, number> = { "²": 2, "³": 3 };

/** Evaluates + - × ÷ ^ ² ³ √ and brackets. Returns null for anything else. */
function evaluate(src: string): { value: number; decimals: number } | null {
  const text = src.replace(/\s+/g, "").replace(/[−–]/g, "-").replace(/[×*]/g, "x").replace(/[÷]/g, "/");
  let i = 0;
  let decimals = 0;
  let bad = false;

  const number = () => {
    const m = text.slice(i).match(/^\d+(\.\d+)?/);
    if (!m) {
      bad = true;
      return 0;
    }
    i += m[0].length;
    decimals = Math.max(decimals, m[1] ? m[1].length - 1 : 0);
    return Number(m[0]);
  };
  const atom = (): number => {
    if (text[i] === "√") {
      i += 1;
      return Math.sqrt(atom());
    }
    if (text[i] === "-") {
      i += 1;
      return -atom();
    }
    if (text[i] === "(") {
      i += 1;
      const v = sum();
      if (text[i] !== ")") bad = true;
      i += 1;
      return v;
    }
    return number();
  };
  const power = (): number => {
    let v = atom();
    for (;;) {
      const sup = SUPER[text[i]];
      if (sup) {
        i += 1;
        v **= sup;
      } else if (text[i] === "^") {
        i += 1;
        v **= atom();
      } else return v;
    }
  };
  const product = (): number => {
    let v = power();
    while (text[i] === "x" || text[i] === "/") {
      const op = text[i++];
      const r = power();
      v = op === "x" ? v * r : v / r;
    }
    return v;
  };
  function sum(): number {
    let v = product();
    while (text[i] === "+" || text[i] === "-") {
      const op = text[i++];
      const r = product();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  const value = sum();
  return bad || i !== text.length || !Number.isFinite(value) ? null : { value, decimals };
}

const closeEnough = (a: { value: number; decimals: number }, b: { value: number; decimals: number }) => {
  // "1/3 = 0.33" is fine: allow for rounding to the digits actually written.
  const d = Math.max(a.decimals, b.decimals);
  return Math.abs(a.value - b.value) <= (d ? 0.51 * 10 ** -d : 1e-9);
};

const EQUATION = /[\d√(][\d .+\-−–×x*÷/²³√()=^]*=[\d .+\-−–×x*÷/²³√()=^]*[\d²³)]/g;

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const TENS_WORDS = new RegExp(`\\b(${TENS.join("|")})(?:[ -](${ONES.slice(1, 10).join("|")}))?\\b`, "gi");
const ONES_WORDS = new RegExp(`\\b(${ONES.join("|")})\\b`, "gi");
const SAYS_EQUALS = /\b(equals?|is equal to|sama dengan)\b/i;

/** Speech arrives as words, and scripts are written that way, so "two plus two equals five" counts. */
function spokenToSymbols(sentence: string) {
  return sentence
    .replace(TENS_WORDS, (_, t: string, o?: string) => String((TENS.indexOf(t.toLowerCase()) + 2) * 10 + (o ? ONES.indexOf(o.toLowerCase()) : 0)))
    .replace(ONES_WORDS, (w) => String(ONES.indexOf(w.toLowerCase())))
    .replace(/\s+(squared|kuasa dua)\b/gi, "²")
    .replace(/\s+cubed\b/gi, "³")
    .replace(/\b(plus|tambah)\b/gi, "+")
    .replace(/\b(minus|tolak)\b/gi, "-")
    .replace(/\b(times|multiplied by|darab)\b/gi, "×")
    .replace(/\b(divided by|bahagi)\b/gi, "÷")
    .replace(SAYS_EQUALS, "=");
}

const UNIT = /^(mm|cm|m|km|mg|g|kg|ml|l|s|sec|min|h|hr|hrs|rm|sen|degrees?|percent)$/i;
const unclear = (word?: string) => Boolean(word) && (word!.replace(/[²³]/g, "").length === 1 || UNIT.test(word!));

/**
 * Finds wrong sums in text, written in symbols or spoken in words. A sum touching a variable or a
 * unit ("a² + 9 = 25", "1 = 100 cm") is skipped rather than guessed at, so this only reports sums
 * it fully understood. Ordinary words around a sum don't matter.
 */
export function checkMaths(input: string): string[] {
  const text = input.split(/(?<=[.!?])\s+|\n/).map((s) => (SAYS_EQUALS.test(s) ? spokenToSymbols(s) : s)).join("\n");
  const issues: string[] = [];
  for (const m of text.matchAll(EQUATION)) {
    const start = m.index ?? 0;
    const head = text.slice(0, start);
    const tail = text.slice(start + m[0].length);
    if (/[\p{L}²³]$/u.test(head) || /^\p{L}/u.test(tail)) continue; // attached, as in "a2" or "5x"
    if (/[+\-−–×*÷/^]\s*$/.test(head) || /^\s*[+\-−–×*÷/^]/.test(tail)) continue; // part of a longer expression
    if (unclear(head.match(/([\p{L}²³]+)\s*$/u)?.[1]) || unclear(tail.match(/^\s*([\p{L}²³]+)/u)?.[1])) continue;
    if (/x/.test(m[0]) && !/\d\s*x\s*\d/.test(m[0])) continue;
    const sides = m[0].split("=").map((p) => p.trim()).filter(Boolean);
    if (sides.length < 2) continue;
    const values = sides.map(evaluate);
    for (let i = 1; i < values.length; i++) {
      const a = values[i - 1];
      const b = values[i];
      if (a && b && !closeEnough(a, b)) {
        issues.push(`"${sides[i - 1]} = ${sides[i]}" is wrong: the left side is ${+a.value.toFixed(4)}.`);
        break;
      }
    }
  }
  return [...new Set(issues)];
}

/** Everything a video states as fact, including the numbers drawn on screen. */
export function sceneText(scenes: Scene[]): string {
  const lines: string[] = [];
  for (const sc of scenes) {
    lines.push(sc.title, sc.narration);
    if (sc.formula) lines.push(sc.formula);
    if (sc.visual.kind !== "reel") continue;
    const b = sc.visual.block;
    if (b.type === "formula") lines.push(...b.steps);
    if (b.type === "stat") lines.push(`${b.label}: ${b.prefix ?? ""}${b.to}${b.suffix ?? ""}`);
    if (b.type === "card") lines.push(`${b.title}. ${b.body ?? ""}`);
    if (b.type === "checklist") lines.push(...b.items);
    if (b.type === "compare") lines.push(`${b.left.title}: ${b.left.body ?? ""}`, `${b.right.title}: ${b.right.body ?? ""}`);
    if (b.type === "fraction") lines.push(`Fraction drawn: ${b.shaded} of ${b.parts} parts, labelled "${b.label}"`);
    if (b.type === "triangle") lines.push(`Right-angled triangle with sides a=${b.a}, b=${b.b}, hypotenuse c=${b.c}`);
  }
  return lines.filter(Boolean).join("\n");
}

/** A drawn right-angled triangle must actually be right-angled. */
export function checkTriangles(scenes: Scene[]): string[] {
  const issues: string[] = [];
  for (const sc of scenes) {
    if (sc.visual.kind !== "reel" || sc.visual.block.type !== "triangle") continue;
    const { a, b, c } = sc.visual.block;
    const [x, y, z] = [a, b, c].map(Number);
    if ([x, y, z].every(Number.isFinite) && Math.abs(x * x + y * y - z * z) > 0.05 * z * z)
      issues.push(`Triangle with sides ${a}, ${b}, ${c} is not right-angled.`);
  }
  return issues;
}
