"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClassroomState } from "@/lib/types";
import type { ClassroomEngine } from "@/lib/engine";

export default function Header({ state, engine, micWanted, setMicWanted }: { state: ClassroomState; engine: ClassroomEngine; micWanted: boolean; setMicWanted: (v: boolean) => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const live = state.lesson.status === "live";
  const elapsed = live && state.lesson.startedAt ? Math.floor((now - state.lesson.startedAt) / 1000) : 0;
  const listening = state.listening === "listening";
  const demo = state.demo.running;

  const micLabel = {
    listening: "LISTENING", paused: "PAUSED", off: "MIC OFF", denied: "MIC BLOCKED", unsupported: "NO SPEECH API",
  }[state.listening];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🎓</span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-tight text-white">Agentic AI Smart Classroom</span>
            <span className="block text-[11px] text-slate-400">Teacher dashboard</span>
          </span>
        </Link>

        <div
          className={`ml-2 flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
            listening ? "bg-red-500/15 text-red-200 ring-red-500/50" : demo ? "bg-amber-500/15 text-amber-200 ring-amber-500/40" : "bg-slate-800 text-slate-300 ring-slate-700"
          }`}
          role="status"
          aria-live="polite"
        >
          <span className={`h-2.5 w-2.5 rounded-full ${listening ? "bg-red-500 animate-pulse" : demo ? "bg-amber-400 animate-pulse" : "bg-slate-500"}`} />
          🎙 {demo && !listening ? "DEMO VOICE" : micLabel}
          {(listening || demo) && (
            <span className="eq ml-1 flex h-3 items-end gap-0.5">
              {[0, 1, 2, 3].map((i) => <span key={i} className="w-0.5 bg-current" />)}
            </span>
          )}
        </div>

        {state.voice.speaking && (
          <button className="chip bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/40" onClick={() => engine.stopSpeaking()} title="Stop AI speech">
            🔊 AI speaking — stop
          </button>
        )}

        <span className={`chip ${state.aiProvider.llm ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}`} title="Language-model provider">
          🧠 {state.aiProvider.llm ? state.aiProvider.model : "On-device agents (offline-safe)"}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {live && <span className="font-mono text-sm text-slate-300">⏱ {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>}
          {!live ? (
            <button className="btn btn-primary" onClick={() => { engine.startLesson(); setMicWanted(true); }}>▶ Start lesson</button>
          ) : (
            <>
              {micWanted ? (
                <button className="btn btn-ghost" onClick={() => { setMicWanted(false); engine.setListening("paused"); }}>⏸ Pause listening</button>
              ) : (
                <button className="btn btn-primary" onClick={() => setMicWanted(true)}>🎙 Listen</button>
              )}
              <button className="btn btn-danger" onClick={() => { setMicWanted(false); engine.endLesson(); }}>■ End lesson</button>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => window.open("/display", "asc-display", "popup,width=1280,height=760")}>📺 Open classroom display</button>
        </div>
      </div>
    </header>
  );
}
