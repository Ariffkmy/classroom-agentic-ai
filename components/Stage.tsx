"use client";
// Classroom Display (student-facing). Always rendered on a 1280×720 canvas and scaled,
// so the projector view and the teacher's preview look identical.

import { useEffect, useRef, useState } from "react";
import type { ClassroomState } from "@/lib/types";
import SceneVisual from "./visuals/SceneVisual";
import ReelScene from "./visuals/ReelScene";
import { DISCUSS_LABEL } from "@/lib/reel/styles";
import { PASS_RATE } from "@/lib/agent/brain";

const LETTERS = ["A", "B", "C", "D", "E"];
const OPTION_COLORS = ["bg-sky-600", "bg-violet-600", "bg-amber-600", "bg-emerald-600"];

export function ScaledStage({ state, className = "" }: { state: ClassroomState; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setScale(Math.min(r.width / 1280, r.height / 720));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <div className="absolute left-1/2 top-1/2" style={{ width: 1280, height: 720, transform: `translate(-50%,-50%) scale(${scale})` }}>
        <Stage state={state} />
      </div>
    </div>
  );
}

export default function Stage({ state }: { state: ClassroomState }) {
  const p = state.presentation;
  return (
    <div className="stage-bg relative h-[720px] w-[1280px] overflow-hidden text-white">
      {p.mode === "idle" && <IdleView state={state} />}
      {p.mode === "content" && <ContentView state={state} />}
      {p.mode === "explanation" && p.explanation && <ExplanationView {...p.explanation} />}
      {p.mode === "quiz" && <QuizView state={state} />}
      {p.mode === "results" && <ResultsView state={state} />}
      {p.mode === "challenge" && <ChallengeView state={state} />}
      <PrivacyBar state={state} />
    </div>
  );
}

function PrivacyBar({ state }: { state: ClassroomState }) {
  const on = state.listening === "listening" || state.demo.running;
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between bg-black/70 px-6 py-2 text-[15px] text-slate-300">
      <span className="flex items-center gap-2">
        <span className={`inline-block h-3 w-3 rounded-full ${on ? "bg-red-500 animate-pulse" : "bg-slate-500"}`} aria-hidden />
        {on ? "AI assistant is listening to the teacher" : "AI listening is OFF"} · audio is never stored · no cameras, no student identification
      </span>
      <span className="font-semibold tracking-wide text-slate-200">Smart Classroom AI</span>
    </div>
  );
}

function IdleView({ state }: { state: ClassroomState }) {
  const c = state.context;
  const gen = state.tasks.find((t) => ["generating", "validating", "planned"].includes(t.status) && t.kind === "content");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 pb-10">
      <div className="relative flex h-40 w-40 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-indigo-500/30 ring-pulse" />
        <span className="absolute inset-4 rounded-full bg-indigo-500/40 ring-pulse" style={{ animationDelay: "600ms" }} />
        <span className="relative text-7xl">🎓</span>
      </div>
      <div className="text-center">
        <div className="text-5xl font-extrabold tracking-tight">{c.topic ?? (state.lesson.status === "live" ? "Lesson in progress" : "Welcome, class!")}</div>
        <div className="mt-3 text-2xl text-indigo-200">{c.subject ? `${c.subject} · ${c.level}` : "Your AI teaching assistant is ready"}</div>
      </div>
      {c.concepts.length > 0 && (
        <div className="flex max-w-4xl flex-wrap justify-center gap-3">
          {c.concepts.slice(-5).map((k) => (
            <span key={k} className="rounded-full bg-white/10 px-5 py-2 text-xl">{k}</span>
          ))}
        </div>
      )}
      {gen && (
        <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-6 py-3 text-xl text-slate-200">
          <span className="spinner" /> Preparing something to help you understand…
        </div>
      )}
    </div>
  );
}

function ContentView({ state }: { state: ClassroomState }) {
  const p = state.presentation;
  const asset = state.assets.find((a) => a.id === p.assetId);
  if (!asset) return null;
  const sc = asset.scenes[p.scene];
  if (!sc) return null;
  if (sc.visual.kind === "reel") {
    const cfg = state.settings.reel;
    return (
      <>
        <ReelScene
          key={`${asset.id}-${p.scene}`}
          scene={sc}
          style={cfg.style}
          showCaptions={cfg.captions}
          motif={asset.reel?.motif}
          discuss={DISCUSS_LABEL[asset.reel?.language ?? "en"]}
          playing={p.playing}
          startedAt={p.sceneStartedAt}
        />
        {!p.playing && <span className="absolute right-6 top-5 rounded-full bg-amber-500 px-4 py-1 text-[15px] font-bold text-slate-950">⏸ Paused</span>}
        <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/60 px-3 py-1.5" aria-label={`Scene ${p.scene + 1} of ${asset.scenes.length}`}>
          {asset.scenes.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === p.scene ? "w-8 bg-white" : i < p.scene ? "w-3 bg-white/70" : "w-3 bg-white/30"}`} />
          ))}
        </div>
      </>
    );
  }
  return (
    <div className="flex h-full flex-col px-10 pb-14 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[17px] font-semibold uppercase tracking-widest text-indigo-300">
            {asset.isFallback ? "Simple diagram" : asset.format === "animation" ? "Animation" : "Storyboard"} · {asset.title}
          </div>
          <div key={sc.title} className="fade-up mt-1 text-[42px] font-extrabold leading-tight">{sc.title}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-emerald-500/20 px-4 py-1 text-[15px] font-semibold text-emerald-200">✓ Auto-checked · {asset.objectives.map((o) => o.code).slice(0, 2).join(", ")}</span>
          {!p.playing && <span className="rounded-full bg-amber-500/30 px-4 py-1 text-[15px] font-bold text-amber-100">⏸ Paused</span>}
        </div>
      </div>
      <div className="relative mt-2 min-h-0 flex-1">
        <div className="absolute inset-0">
          <SceneVisual visual={sc.visual} sceneKey={`${asset.id}-${p.scene}`} />
        </div>
      </div>
      <div key={`${asset.id}-${p.scene}-cap`} className="fade-up rounded-2xl bg-black/35 px-8 py-4">
        <div className="text-[28px] font-medium leading-snug">{sc.caption}</div>
        {sc.formula && <div className="mt-2 font-mono text-[30px] font-bold text-amber-300">{sc.formula}</div>}
      </div>
      <div className="mt-3 flex justify-center gap-2">
        {asset.scenes.map((_, i) => (
          <span key={i} className={`h-2.5 rounded-full transition-all ${i === p.scene ? "w-10 bg-white" : i < p.scene ? "w-4 bg-white/60" : "w-4 bg-white/20"}`} />
        ))}
      </div>
    </div>
  );
}

function ExplanationView({ title, body, emoji }: { title: string; body: string; emoji?: string }) {
  return (
    <div className="flex h-full items-center justify-center px-24 pb-10">
      <div className="pop w-full rounded-[2rem] bg-white/10 p-14 shadow-2xl ring-1 ring-white/20">
        <div className="flex items-center gap-5">
          <span className="text-8xl">{emoji}</span>
          <div className="text-[22px] font-semibold uppercase tracking-widest text-indigo-200">{title}</div>
        </div>
        <p className="mt-6 text-[40px] font-semibold leading-snug">{body}</p>
      </div>
    </div>
  );
}

function QuizView({ state }: { state: ClassroomState }) {
  const ss = state.quizSession;
  const quiz = state.quizzes.find((q) => q.id === ss?.quizId);
  if (!ss || !quiz) return null;
  const q = quiz.questions[ss.current];
  const answered = Object.values(ss.responses[q.id] ?? {}).filter((v) => v !== null).length;
  return (
    <div className="flex h-full flex-col px-14 pb-16 pt-10">
      <div className="flex items-center justify-between text-[22px] text-indigo-200">
        <span className="font-semibold uppercase tracking-widest">Quick check · Question {ss.current + 1} of {quiz.questions.length}</span>
        <span className="rounded-full bg-white/10 px-5 py-1.5">🪧 Groups answered: {answered}/{ss.groups.length}</span>
      </div>
      <div key={q.id} className="fade-up mt-6 text-[46px] font-extrabold leading-tight">{q.prompt}</div>
      <div className="mt-10 grid flex-1 grid-cols-2 gap-6">
        {q.options.map((o, i) => (
          <div key={i} className={`flex items-center gap-6 rounded-3xl ${OPTION_COLORS[i % 4]} px-8 text-[34px] font-bold shadow-xl transition ${ss.revealed?.includes(q.id) && i !== q.answer ? "opacity-30" : ""}`}>
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-black/25 text-[44px]">{LETTERS[i]}</span>
            {o}
          </div>
        ))}
      </div>
      <div className="mt-6 text-center text-[24px] text-slate-200">Discuss in your group, then hold up your answer card (A, B, C or D)</div>
    </div>
  );
}

function ChallengeView({ state }: { state: ClassroomState }) {
  const ss = state.challengeSession;
  const c = state.challenges.find((x) => x.id === ss?.challengeId);
  if (!ss || !c) return null;
  const step = c.steps[ss.step];
  if (ss.phase === "done") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-24 pb-14 text-center">
        <span className="text-8xl">🏁</span>
        <div className="text-[52px] font-extrabold leading-tight">{c.title}</div>
        <div className="text-[30px] text-indigo-200">Challenge complete. Well done, everyone!</div>
      </div>
    );
  }
  const easier = ss.phase === "support" || ss.phase === "supportReveal";
  const q = easier && step.support ? step.support : step;
  const prompt = easier ? step.support?.question : step.question;
  const revealed = ss.phase === "reveal" || ss.phase === "supportReveal";
  const answered = Object.values(ss.responses).filter((v) => v !== null).length;
  const passed = ss.lastRate >= PASS_RATE;
  return (
    <div className="flex h-full flex-col px-14 pb-14 pt-8">
      <div className="flex items-center justify-between text-[20px] text-indigo-200">
        <span className="font-semibold uppercase tracking-widest">{c.title} · Step {ss.step + 1} of {c.steps.length}{easier ? " · Easier try" : ""}</span>
        {!revealed && <span className="rounded-full bg-white/10 px-5 py-1.5">🪧 Groups answered: {answered}/{ss.groups.length}</span>}
      </div>
      {!easier && <div key={step.id} className="fade-up mt-4 text-[26px] leading-snug text-slate-200">{step.situation}</div>}
      <div key={`${step.id}-${ss.phase}`} className="fade-up mt-3 text-[38px] font-extrabold leading-tight">{prompt}</div>
      <div className="mt-5 grid min-h-0 flex-1 grid-cols-2 gap-4">
        {q.options.map((o, i) => (
          <div key={i} className={`flex items-center gap-5 rounded-3xl px-6 text-[28px] font-bold shadow-xl transition ${OPTION_COLORS[i % 4]} ${revealed && i !== q.answer ? "opacity-30" : ""}`}>
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-black/25 text-[36px]">{LETTERS[i]}</span>
            {o}
          </div>
        ))}
      </div>
      {revealed ? (
        <div className={`pop mt-4 rounded-2xl p-4 text-[24px] leading-snug ring-1 ${passed ? "bg-emerald-500/15 ring-emerald-400/40" : "bg-amber-500/15 ring-amber-400/40"}`}>
          {passed ? (easier ? "Good. That's the idea." : step.right) : step.wrong}
        </div>
      ) : (
        <div className="mt-4 text-center text-[22px] text-slate-200">Talk it through in your group, then hold up your answer card</div>
      )}
    </div>
  );
}

function ResultsView({ state }: { state: ClassroomState }) {
  const ins = state.insights;
  if (!ins) return null;
  return (
    <div className="flex h-full flex-col px-14 pb-16 pt-8">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[20px] font-semibold uppercase tracking-widest text-indigo-200">Class results (groups)</div>
          <div className="text-[48px] font-extrabold">{Math.round(ins.overallRate * 100)}% correct overall</div>
        </div>
        <div className="max-w-md text-right text-[17px] text-slate-300">{ins.caveat}</div>
      </div>
      <div className="mt-6 flex flex-1 flex-col justify-center gap-4">
        {ins.stats.map((s, i) => (
          <div key={s.questionId} className="flex items-center gap-5">
            <span className="w-16 text-[26px] font-bold text-slate-300">Q{i + 1}</span>
            <div className="relative h-12 flex-1 overflow-hidden rounded-xl bg-white/10">
              <div className={`h-full rounded-xl ${s.flagged ? "bg-amber-500" : "bg-emerald-500"} grow-x`} style={{ width: `${Math.max(3, s.rate * 100)}%` }} />
              <span className="absolute inset-y-0 left-4 flex items-center text-[20px] font-semibold drop-shadow">{s.prompt.slice(0, 70)}{s.prompt.length > 70 ? "…" : ""}</span>
            </div>
            <span className="w-48 text-[24px] font-bold">
              {s.correct}/{s.responses} {s.flagged ? "⚠ review" : "✓"}
            </span>
          </div>
        ))}
      </div>
      {ins.weakConcepts.length > 0 && (
        <div className="mt-4 rounded-2xl bg-amber-500/15 p-5 text-[24px] ring-1 ring-amber-400/40">
          <b>Let&apos;s look again at:</b> {ins.followUp?.title ?? ins.weakConcepts.join(", ")}
        </div>
      )}
    </div>
  );
}
