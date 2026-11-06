// The reel plan: Reel Studio's hook + one row per spoken sentence. Plans arrive from a model
// or the on-device composer; sanitizePlan treats the former as untrusted input.

import type { ReelBlock, ReelConfig, Scene } from "../types";
import { reelLanguage } from "./styles";

export interface ReelRow {
  spoken: string;
  text: string; // on-screen key words; *word* marks the accent
  block: ReelBlock;
}

export interface ReelPlan {
  title: string;
  motif?: string;
  rows: ReelRow[]; // rows[0] is the hook, the last row is the group question
  notes?: string;
}

export interface ReelInput {
  subject: string;
  topic: string;
  level: string;
  concepts: string[];
  keywords: string[];
  objectives: string[];
  sentences: string[]; // what the teacher actually said, oldest first
  focus?: string; // quiz evidence: the idea to re-teach
  variant?: boolean; // teacher asked for a different version
  style: { name: string; brief: string };
  language: { label: string; rules: string };
  lengthSec: number;
  wordsTarget: number;
}

export const wordsTarget = (cfg: ReelConfig) => Math.round(cfg.lengthSec * reelLanguage(cfg.language).wps);

export const REEL_TAIL_S = 0.9; // hold after the last word so a scene can land
const MIN_ROWS = 3;
const MAX_ROWS = 9;
const MAX_TOTAL_S = 110; // the validator rejects anything over 120 s

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const rec = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

function sanitizeBlock(raw: unknown, fallbackTitle: string): ReelBlock {
  const b = rec(raw);
  const card: ReelBlock = { type: "card", title: fallbackTitle };
  switch (b.type) {
    case "card": {
      const title = str(b.title, 60);
      return title ? { type: "card", title, body: str(b.body, 130) || undefined, icon: str(b.icon, 8) || undefined } : card;
    }
    case "stat": {
      const to = num(b.to);
      if (to === null) return card;
      return { type: "stat", to, from: num(b.from) ?? 0, prefix: str(b.prefix, 6), suffix: str(b.suffix, 8), dec: Math.max(0, Math.min(3, num(b.dec) ?? 0)), label: str(b.label, 70) };
    }
    case "checklist": {
      const items = list(b.items, 5).map((x) => str(x, 56)).filter(Boolean);
      return items.length >= 2 ? { type: "checklist", items } : card;
    }
    case "bars": {
      const data = list(b.data, 6).map((x) => { const d = rec(x); return { label: str(d.label, 18), v: Math.max(0, num(d.v) ?? 0), hi: d.hi === true }; }).filter((d) => d.label && d.v > 0);
      return data.length >= 2 ? { type: "bars", data } : card;
    }
    case "flow": {
      const items = list(b.items, 4).map((x) => { const d = rec(x); return { icon: str(d.icon, 8) || undefined, label: str(d.label, 30) }; }).filter((d) => d.label);
      return items.length >= 2 ? { type: "flow", items } : card;
    }
    case "compare": {
      const l = rec(b.left), r = rec(b.right);
      const lt = str(l.title, 40), rt = str(r.title, 40);
      return lt && rt ? { type: "compare", left: { title: lt, body: str(l.body, 90) || undefined }, right: { title: rt, body: str(r.body, 90) || undefined }, strikeLeft: b.strikeLeft === true } : card;
    }
    case "formula": {
      const steps = list(b.steps, 4).map((x) => str(x, 44)).filter(Boolean);
      return steps.length ? { type: "formula", steps } : card;
    }
    case "triangle":
      return { type: "triangle", a: str(b.a, 8) || "a", b: str(b.b, 8) || "b", c: str(b.c, 8) || "c", highlight: b.highlight === "right" || b.highlight === "none" ? b.highlight : "hyp" };
    case "fraction": {
      const parts = Math.round(num(b.parts) ?? 0);
      const shaded = Math.round(num(b.shaded) ?? -1);
      return parts >= 2 && parts <= 12 && shaded >= 0 && shaded <= parts ? { type: "fraction", parts, shaded, label: str(b.label, 50) } : card;
    }
    case "objects": {
      const items = list(b.items, 4).map((x) => { const d = rec(x); return { icon: str(d.icon, 8), label: str(d.label, 26) }; }).filter((d) => d.icon && d.label);
      return items.length ? { type: "objects", items } : card;
    }
    case "question": {
      const text = str(b.text, 150);
      return text ? { type: "question", text } : card;
    }
    default:
      return card;
  }
}

/** Returns a safe plan, or null when the input cannot be used. */
export function sanitizePlan(raw: unknown): ReelPlan | null {
  const p = rec(raw);
  const rows: ReelRow[] = list(p.rows, MAX_ROWS)
    .map((x) => {
      const r = rec(x);
      const spoken = str(r.spoken, 230);
      const text = str(r.text, 64);
      return { spoken, text: text || spoken.slice(0, 40), block: sanitizeBlock(r.block, text.replace(/\*/g, "") || spoken.slice(0, 40)) };
    })
    .filter((r) => r.spoken);
  if (rows.length < MIN_ROWS) return null;
  rows[0].block = { type: "headline" }; // the hook is always the headline, as in Reel Studio
  return { title: str(p.title, 70) || "Lesson video", motif: str(p.motif, 8) || undefined, rows, notes: str(p.notes, 200) || undefined };
}

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Estimated time of each word: browser speech has no timestamps, so longer words get more time. */
export function wordTimes(spoken: string, seconds: number): number[] {
  const weights = spoken.split(/\s+/).filter(Boolean).map((w) => w.length + 2);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let at = 0;
  return weights.map((w) => {
    const t = (at / total) * seconds;
    at += w;
    return t;
  });
}

const sceneMs = (spoken: string, wps: number) => Math.round(Math.max(3.5, countWords(spoken) / wps + REEL_TAIL_S) * 1000);

/** Maps plan rows onto the Scene model the orchestrator, validator and display already share. */
export function planToScenes(plan: ReelPlan, cfg: ReelConfig): Scene[] {
  const wps = reelLanguage(cfg.language).wps;
  const rows = [...plan.rows];
  // Keep the hook and the closing question; drop from the middle if the script ran long.
  while (rows.length > MIN_ROWS && rows.reduce((a, r) => a + sceneMs(r.spoken, wps), 0) / 1000 > MAX_TOTAL_S) rows.splice(rows.length - 2, 1);
  return rows.map((r, i) => {
    const b = r.block;
    return {
      title: r.text.replace(/\*/g, ""),
      caption: r.spoken,
      narration: r.spoken,
      formula: b.type === "formula" ? b.steps[b.steps.length - 1] : undefined,
      durationMs: sceneMs(r.spoken, wps),
      visual: { kind: "reel" as const, headline: r.text, block: b, role: i === 0 ? ("hook" as const) : b.type === "question" ? ("question" as const) : ("body" as const) },
    };
  });
}
