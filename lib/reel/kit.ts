// Scene toolkit ported from Reel Studio (kit/assets/rs-lib.js) and laid out for a 1920×1080
// classroom display instead of a 1080×1920 reel. Every entrance lands on a spoken word, and
// everything only adds tweens to one paused timeline, so a scene can be seeked to any moment.
//
// Scene text comes from a model or a microphone, so it is only ever set with textContent.

import gsap from "gsap";
import type { ReelBlock, ReelStyleId, Scene } from "../types";
import { REEL_TAIL_S, wordTimes } from "./plan";

const clean = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const SVG = "http://www.w3.org/2000/svg";

const ENTER: Record<string, [gsap.TweenVars, gsap.TweenVars]> = {
  up: [{ autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, ease: "power3.out" }],
  left: [{ autoAlpha: 0, x: -120 }, { autoAlpha: 1, x: 0, ease: "power3.out" }],
  right: [{ autoAlpha: 0, x: 120 }, { autoAlpha: 1, x: 0, ease: "power3.out" }],
  pop: [{ autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, ease: "back.out(2)" }],
  drop: [{ autoAlpha: 0, y: -160, rotation: -5 }, { autoAlpha: 1, y: 0, rotation: 0, ease: "bounce.out" }],
  fade: [{ autoAlpha: 0 }, { autoAlpha: 1, ease: "power1.out" }],
};

interface Kit {
  root: HTMLElement;
  tl: gsap.core.Timeline;
  dur: number;
  /** Time of the first spoken word matching any word in `text`, or `fallback`. */
  cue(text: string, fallback: number): number;
  /** Spreads entrances across the sentence, preferring the word each one is about. */
  cues(texts: string[]): number[];
  div(cls: string, parent?: Element, text?: string): HTMLElement;
  place(e: HTMLElement, x: number, y: number, w?: number): HTMLElement;
  enter(e: gsap.TweenTarget, at: number, kind?: string, d?: number): void;
  idle(e: HTMLElement, amp?: number, period?: number): void;
  punch(e: HTMLElement, at: number): void;
  draw(p: SVGGeometryElement, at: number, d?: number): void;
}

function makeKit(root: HTMLElement, tl: gsap.core.Timeline, words: string[], W: number[], dur: number): Kit {
  const spokenEnd = Math.max(0.5, dur - REEL_TAIL_S);
  const find = (word: string) => {
    const q = clean(word);
    return q ? words.findIndex((w) => clean(w) === q) : -1;
  };
  const k: Kit = {
    root, tl, dur,
    cue(text, fallback) {
      for (const w of text.split(/\s+/)) {
        const i = w.length > 2 ? find(w) : -1;
        if (i >= 0) return W[i];
      }
      return fallback;
    },
    cues(texts) {
      let last = -0.4;
      return texts.map((t, i) => {
        const even = spokenEnd * (0.08 + (0.8 * i) / Math.max(1, texts.length));
        const at = Math.max(k.cue(t, even), last + 0.4);
        last = at;
        return Math.min(at, spokenEnd);
      });
    },
    div(cls, parent = root, text) {
      const e = document.createElement("div");
      e.className = cls;
      if (text != null) e.textContent = text;
      parent.appendChild(e);
      return e;
    },
    place(e, x, y, w) {
      e.style.position = "absolute";
      e.style.left = `${x}px`;
      e.style.top = `${y}px`;
      if (w != null) e.style.width = `${w}px`;
      return e;
    },
    enter(e, at, kind = "up", d = 0.55) {
      const [from, to] = ENTER[kind] ?? ENTER.up;
      tl.fromTo(e, { ...from }, { ...to, duration: d }, Math.max(0, at));
    },
    // Uses the CSS `translate` property so it never fights the GSAP transforms on the element.
    idle(e, amp = 8, period = 2.6) {
      const o = { v: 0 };
      tl.to(o, {
        v: dur, duration: dur, ease: "none",
        onUpdate: () => { e.style.translate = `0 ${(Math.sin((o.v / period) * Math.PI * 2) * amp).toFixed(2)}px`; },
      }, 0);
    },
    punch(e, at) {
      tl.to(e, { keyframes: [{ scale: 1.1, duration: 0.12, ease: "power2.out" }, { scale: 1, duration: 0.18, ease: "power2.in" }] }, Math.max(0, at));
    },
    draw(p, at, d = 0.8) {
      const L = p.getTotalLength();
      p.style.strokeDasharray = String(L);
      tl.fromTo(p, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: d, ease: "power2.inOut" }, Math.max(0, at));
    },
  };
  return k;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const [a, v] of Object.entries(attrs)) e.setAttribute(a, String(v));
  parent.appendChild(e);
  return e;
}

/** Headline revealed word by word with the voice. *word* or *several words* take the accent. */
function headline(k: Kit, text: string, role: "hook" | "body" | "question") {
  const plain = text.replace(/\*/g, "");
  const big = role === "hook";
  const size = plain.length <= 24 ? (big ? 150 : 92) : plain.length <= 46 ? (big ? 124 : 80) : big ? 100 : 66;
  const box = k.div("rs-head rs-title");
  k.place(box, 110, big ? 300 : 66, 1700);
  box.style.fontSize = `${size}px`;
  if (big) box.style.textAlign = "center";
  let accent = false;
  text.trim().split(/\s+/).forEach((p, i) => {
    if (p.startsWith("*")) accent = true;
    const sp = k.div(`rs-w${accent ? " rs-hi" : ""}`, box, p.replace(/\*/g, ""));
    if (/\*[.,!?:;]*$/.test(p)) accent = false;
    box.appendChild(document.createTextNode(" "));
    const at = big ? k.cue(p.replace(/\*/g, ""), 0.1 + i * 0.16) - 0.05 : 0.05 + i * 0.08;
    k.tl.fromTo(sp, { autoAlpha: 0, y: 40, scale: 0.92 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(2)" }, Math.max(0, at));
  });
}

const FRAME = { x: 110, w: 1700 };

function drawCard(k: Kit, b: Extract<ReelBlock, { type: "card" }>) {
  const c = k.div("rs-card rs-hero");
  k.place(c, 300, 290, 1320);
  if (b.icon) k.div("rs-ico", c, b.icon);
  k.div("rs-ct", c, b.title);
  if (b.body) k.div("rs-cb", c, b.body);
  k.enter(c, 0.25, "pop");
  k.idle(c);
}

function drawStat(k: Kit, b: Extract<ReelBlock, { type: "stat" }>) {
  const box = k.div("rs-stat");
  k.place(box, FRAME.x, 310, FRAME.w);
  const num = k.div("rs-num", box);
  k.div("rs-lab", box, b.label);
  const at = k.cue(String(b.to), 0.5);
  const fmt = (v: number) => {
    const [i, f] = v.toFixed(b.dec ?? 0).split(".");
    num.textContent = `${b.prefix ?? ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${f ? `.${f}` : ""}${b.suffix ?? ""}`;
  };
  fmt(b.from ?? 0);
  const o = { v: b.from ?? 0 };
  k.enter(box, Math.max(0, at - 0.3), "up");
  k.tl.to(o, { v: b.to, duration: 1.2, ease: "power2.out", onUpdate: () => fmt(o.v) }, at);
  k.punch(num, at + 1.2);
}

function drawChecklist(k: Kit, b: Extract<ReelBlock, { type: "checklist" }>) {
  const box = k.div("rs-list");
  k.place(box, 280, 260, 1360);
  const ats = k.cues(b.items);
  b.items.forEach((item, i) => {
    const li = k.div("rs-li", box);
    const tick = k.div("rs-box", li);
    const svg = svgEl("svg", { viewBox: "0 0 24 24" }, tick);
    const path = svgEl("path", { d: "M5 12.5l4.2 4.2L19 7" }, svg);
    k.div("", li, item);
    k.enter(li, ats[i] - 0.2, "left", 0.4);
    k.draw(path, ats[i] + 0.1, 0.3);
    k.tl.fromTo(tick, { backgroundColor: "rgba(0,0,0,0)" }, { backgroundColor: "var(--rs-accent)", duration: 0.2 }, ats[i] + 0.1);
  });
}

function drawBars(k: Kit, b: Extract<ReelBlock, { type: "bars" }>) {
  const max = Math.max(...b.data.map((d) => d.v));
  const box = k.div("rs-bars");
  k.place(box, 360, 260, 1200);
  const ats = k.cues(b.data.map((d) => d.label));
  b.data.forEach((d, i) => {
    const bar = k.div("rs-bar", box);
    const value = k.div("rs-bv", bar, String(d.v));
    const fill = document.createElement("b");
    fill.style.height = `${(d.v / max) * 78}%`;
    if (d.hi) fill.className = "hi";
    bar.appendChild(fill);
    k.div("rs-bl", bar, d.label);
    k.tl.fromTo(fill, { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: "power3.out" }, ats[i]);
    k.enter(value, ats[i] + 0.3, "fade", 0.3);
  });
}

function drawFlow(k: Kit, b: Extract<ReelBlock, { type: "flow" }>) {
  const n = b.items.length;
  const gap = 110;
  const w = Math.min(460, (FRAME.w - gap * (n - 1)) / n);
  const x0 = (1920 - (n * w + (n - 1) * gap)) / 2;
  const y = 320;
  const ats = k.cues(b.items.map((i) => i.label));
  const svg = svgEl("svg", { width: 1920, height: 1080, class: "rs-arrow rs-overlay" }, k.root);
  b.items.forEach((item, i) => {
    const x = x0 + i * (w + gap);
    const node = k.div("rs-card rs-node");
    k.place(node, x, y, w);
    if (item.icon) k.div("rs-nodei", node, item.icon);
    k.div("rs-nodel", node, item.label);
    k.enter(node, ats[i], "pop");
    if (i < n - 1) {
      const x1 = x + w + 14, x2 = x + w + gap - 18, ay = y + 150;
      const line = svgEl("path", { d: `M${x1} ${ay} L${x2} ${ay}` }, svg);
      const head = svgEl("path", { d: `M${x2 - 22} ${ay - 18} L${x2} ${ay} L${x2 - 22} ${ay + 18}` }, svg);
      k.draw(line, ats[i + 1] - 0.45, 0.35);
      k.draw(head, ats[i + 1] - 0.15, 0.15);
    }
  });
}

function drawCompare(k: Kit, b: Extract<ReelBlock, { type: "compare" }>) {
  const ats = k.cues([b.left.title, b.right.title]);
  [b.left, b.right].forEach((side, i) => {
    const c = k.div("rs-card rs-side");
    k.place(c, i === 0 ? 150 : 1000, 290, 770);
    k.div("rs-ct", c, side.title);
    if (side.body) k.div("rs-cb", c, side.body);
    k.enter(c, ats[i], i === 0 ? "left" : "right");
    if (i === 0 && b.strikeLeft) {
      const line = k.div("rs-strike", c);
      k.tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power2.out" }, ats[1] + 0.2);
    }
  });
}

function drawFormula(k: Kit, b: Extract<ReelBlock, { type: "formula" }>) {
  const box = k.div(`rs-formula${b.steps.length <= 2 ? " few" : ""}`);
  k.place(box, FRAME.x, 230, FRAME.w);
  const ats = k.cues(b.steps);
  b.steps.forEach((step, i) => {
    const last = i === b.steps.length - 1;
    const line = k.div(`rs-fline${last ? " rs-accent" : ""}`, box, step);
    k.enter(line, ats[i], "up");
    if (last) k.punch(line, ats[i] + 0.7);
  });
}

function drawTriangle(k: Kit, b: Extract<ReelBlock, { type: "triangle" }>) {
  const [ox, oy, w, h] = [640, 790, 640, 480]; // right angle at the bottom left, sides in a 3:4 ratio
  const svg = svgEl("svg", { width: 1920, height: 1080, class: "rs-tri rs-overlay" }, k.root);
  const sideA = svgEl("line", { x1: ox, y1: oy, x2: ox, y2: oy - h }, svg);
  const sideB = svgEl("line", { x1: ox, y1: oy, x2: ox + w, y2: oy }, svg);
  const hyp = svgEl("line", { x1: ox, y1: oy - h, x2: ox + w, y2: oy, class: b.highlight === "hyp" ? "on" : "" }, svg);
  const mark = svgEl("path", { d: `M${ox} ${oy - 56} L${ox + 56} ${oy - 56} L${ox + 56} ${oy}`, class: b.highlight === "right" ? "mark on" : "mark" }, svg);
  const label = (text: string, x: number, y: number, on: boolean) => {
    const t = svgEl("text", { x, y, "text-anchor": "middle", class: on ? "on" : "" }, svg);
    t.textContent = text;
    return t;
  };
  const la = label(b.a, ox - 70, oy - h / 2 + 24, false);
  const lb = label(b.b, ox + w / 2, oy + 74, false);
  const lc = label(b.c, ox + w / 2 + 62, oy - h / 2 - 22, b.highlight === "hyp");
  k.draw(sideA, 0.2, 0.5);
  k.draw(sideB, 0.6, 0.5);
  k.draw(hyp, 1, 0.6);
  k.draw(mark, 1.5, 0.3);
  k.enter([la, lb, lc], 1.5, "fade", 0.4);
  if (b.highlight === "hyp") {
    const at = k.cue("hypotenuse longest", 1.8);
    k.tl.fromTo(hyp, { strokeWidth: 12 }, { strokeWidth: 26, duration: 0.25, yoyo: true, repeat: 3, ease: "sine.inOut" }, Math.max(1.6, at));
  }
}

function drawFraction(k: Kit, b: Extract<ReelBlock, { type: "fraction" }>) {
  const svg = svgEl("svg", { width: 1920, height: 1080, class: "rs-pie rs-overlay" }, k.root);
  const [cx, cy, r] = [960, 490, 240];
  for (let i = 0; i < b.parts; i++) {
    const a0 = (i / b.parts) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / b.parts) * Math.PI * 2 - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M${cx} ${cy} L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`;
    k.enter(svgEl("path", { d, class: i < b.shaded ? "on" : "" }, svg), 0.3 + i * 0.1, "fade", 0.3);
  }
  const lab = k.div("rs-lab rs-centre", k.root, b.label);
  k.place(lab, FRAME.x, 745, FRAME.w);
  k.enter(lab, 0.9, "up");
}

function drawObjects(k: Kit, b: Extract<ReelBlock, { type: "objects" }>) {
  const row = k.div("rs-objects");
  k.place(row, FRAME.x, 300, FRAME.w);
  const ats = k.cues(b.items.map((i) => i.label));
  b.items.forEach((item, i) => {
    const o = k.div("rs-obj", row);
    k.div("rs-obji", o, item.icon);
    k.div("rs-objl", o, item.label);
    k.enter(o, ats[i], "drop", 0.8);
    k.idle(o, 10, 2.2 + i * 0.3);
  });
}

function drawQuestion(k: Kit, b: Extract<ReelBlock, { type: "question" }>, discuss: string) {
  const c = k.div("rs-card rs-hero rs-q");
  k.place(c, 240, 240, 1440);
  k.div("rs-qi", c, "🤔");
  k.div("rs-ct", c, b.text);
  const chip = k.div("rs-chip", c, discuss);
  k.enter(c, 0.2, "pop");
  k.enter(chip, Math.max(0.6, k.dur - 2.2), "up");
  k.punch(chip, Math.max(1, k.dur - 1.5));
}

/** Word-by-word captions on the voice, chunked like Reel Studio's "auto" captions. */
function captions(k: Kit, words: string[], W: number[]) {
  const SIZE = 7;
  for (let i = 0; i < words.length; i += SIZE) {
    const line = k.div("rs-cap");
    words.slice(i, i + SIZE).forEach((word, j) => {
      const sp = k.div("rs-cw", line, word);
      line.appendChild(document.createTextNode(" "));
      k.tl.set(sp, { color: "var(--rs-accent)" }, W[i + j]);
      if (W[i + j + 1] != null) k.tl.set(sp, { color: "var(--rs-ink)" }, W[i + j + 1]);
    });
    k.tl.set(line, { autoAlpha: 1 }, W[i]);
    if (i + SIZE < words.length) k.tl.set(line, { autoAlpha: 0 }, W[i + SIZE]);
  }
}

function background(root: HTMLElement, tl: gsap.core.Timeline, style: ReelStyleId, dur: number) {
  const bg = document.createElement("div");
  bg.className = `rs-bg rs-bg-${style}`;
  root.appendChild(bg);
  if (style === "neon" || style === "storybook") {
    let seed = 11; // same field on every scene, so a cut never reshuffles it
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const dots = document.createElement("div");
    dots.className = "rs-dots";
    for (let i = 0; i < 56; i++) {
      const d = document.createElement("i");
      const z = 3 + Math.floor(rnd() * 5);
      d.style.cssText = `left:${(rnd() * 1920).toFixed(0)}px;top:${(rnd() * 1080).toFixed(0)}px;width:${z}px;height:${z}px;opacity:${(0.25 + rnd() * 0.65).toFixed(2)}`;
      dots.appendChild(d);
    }
    bg.appendChild(dots);
    tl.fromTo(dots, { y: 0 }, { y: -40, duration: dur, ease: "none" }, 0);
  }
  if (style === "storybook") {
    for (const cls of ["rs-moon", "rs-hill"]) {
      const e = document.createElement("div");
      e.className = cls;
      bg.appendChild(e);
    }
  }
}

export interface BuildOptions {
  scene: Scene;
  style: ReelStyleId;
  showCaptions: boolean;
  motif?: string;
  discuss: string;
}

/** Fills `root` with the scene and returns its paused timeline. */
export function buildReelScene(root: HTMLElement, o: BuildOptions): gsap.core.Timeline {
  const { scene } = o;
  if (scene.visual.kind !== "reel") throw new Error("Not a reel scene");
  const { block, headline: title, role } = scene.visual;
  const dur = scene.durationMs / 1000;
  const words = scene.narration.split(/\s+/).filter(Boolean);
  const W = wordTimes(scene.narration, Math.max(0.5, dur - REEL_TAIL_S));
  const tl = gsap.timeline({ paused: true });
  root.dataset.theme = o.style;
  background(root, tl, o.style, dur);
  const k = makeKit(root, tl, words, W, dur);

  if (block.type !== "question") headline(k, title, role);
  switch (block.type) {
    case "card": drawCard(k, block); break;
    case "stat": drawStat(k, block); break;
    case "checklist": drawChecklist(k, block); break;
    case "bars": drawBars(k, block); break;
    case "flow": drawFlow(k, block); break;
    case "compare": drawCompare(k, block); break;
    case "formula": drawFormula(k, block); break;
    case "triangle": drawTriangle(k, block); break;
    case "fraction": drawFraction(k, block); break;
    case "objects": drawObjects(k, block); break;
    case "question": drawQuestion(k, block, o.discuss); break;
    case "headline": break;
  }

  if (o.motif) {
    const m = k.div(`rs-motif${role === "body" ? "" : " big"}`, root, o.motif);
    k.enter(m, 0.1, "pop");
    k.idle(m, 6, 3);
  }
  if (o.showCaptions) captions(k, words, W);
  tl.set({}, {}, dur); // the timeline spans the whole scene
  return tl;
}
