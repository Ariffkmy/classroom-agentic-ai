"use client";
import { useEffect, useRef, useState } from "react";
import type { ClassroomState } from "@/lib/types";
import type { ClassroomEngine } from "@/lib/engine";
import { DEMO_SCRIPTS } from "@/lib/demoScripts";
import { fmtTime } from "./ui";

const QUICK = [
  ["💡 Everyday example", "Hey assistant, give another everyday example."],
  ["🧩 Simpler", "Hey assistant, explain this in simpler language."],
  ["🎬 Animation", "Hey assistant, create an animation for this topic."],
  ["📝 5 questions", "Hey assistant, prepare five questions based on this lesson."],
  ["📋 Summary", "Hey assistant, give a summary of the lesson."],
  ["⏹ Stop", "Hey assistant, stop the current activity."],
];

export default function TranscriptPanel({ state, engine }: { state: ClassroomState; engine: ClassroomEngine }) {
  const [text, setText] = useState("");
  const [script, setScript] = useState("pythagoras");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight; // scroll only the transcript, never the page
  }, [state.transcript.length, state.interim]);

  const submit = () => {
    if (!text.trim()) return;
    engine.ingest(text, "text");
    setText("");
  };

  return (
    <section className="card flex min-h-0 flex-col" aria-label="Live transcript">
      <div className="card-h">
        <span>🗣 Live classroom transcript</span>
        <span className="text-xs font-normal text-slate-400">Audio not stored · text only</span>
      </div>

      {(state.listening === "denied" || state.listening === "unsupported") && (
        <div className="m-3 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-200 ring-1 ring-amber-500/30">
          {state.listening === "denied" ? "Microphone permission was denied." : "This browser has no live speech recognition (try Chrome or Edge)."} Use the text box or demo script below — the lesson continues normally.
        </div>
      )}

      <div ref={listRef} className="min-h-0 max-h-[60vh] flex-1 space-y-2 overflow-y-auto p-3 xl:max-h-none">
        {state.transcript.length === 0 && !state.interim && (
          <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            Start the lesson and simply teach. No subject or topic setup needed — the AI works it out.
            <br />
            <span className="text-slate-500">Talk to the AI by starting with “Hey assistant…”. After it replies, just answer back.</span>
          </div>
        )}
        {state.transcript.map((s) => (
          <div key={s.id} className={`slide-in flex gap-2 text-sm ${s.speaker === "ai" ? "justify-end" : ""}`}>
            <div
              className={`max-w-[92%] rounded-xl px-3 py-2 ${
                s.speaker === "ai" ? "bg-amber-500/15 text-amber-50 ring-1 ring-amber-500/30" : s.addressedToAI ? "bg-indigo-500/20 ring-1 ring-indigo-400/40" : "bg-slate-800/80"
              }`}
            >
              <div className="mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                <span>{s.speaker === "ai" ? "🤖 AI assistant" : s.addressedToAI ? "👩‍🏫 Teacher → AI" : "👩‍🏫 Teacher"}</span>
                <span>{fmtTime(s.t)}</span>
                {s.source && s.source !== "mic" && <span className="text-slate-500">({s.source})</span>}
              </div>
              {s.text}
            </div>
          </div>
        ))}
        {state.interim && (
          <div className="rounded-xl bg-slate-800/40 px-3 py-2 text-sm italic text-slate-300">
            {state.interim}
            <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-slate-300 align-middle" />
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-800 p-3">
        <div role="status" aria-live="polite">
          {state.conversation.thinking && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 ring-1 ring-amber-500/30">
              <span className="spinner !h-3 !w-3 !border-2" /> Thinking…
            </div>
          )}
          {state.conversation.listeningUntil > 0 && !state.conversation.thinking && (
            <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 ring-1 ring-emerald-500/30">
              💬 Go ahead, I&apos;m listening. No need to say “Hey assistant”. Say “thanks” to finish.
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map(([label, cmd]) => (
            <button key={label} className="btn btn-ghost !px-2 !py-1 !text-xs" onClick={() => engine.ingest(cmd, "text")} title={cmd}>
              {label}
            </button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type teacher speech (fallback) or “Hey assistant, …”"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            aria-label="Text input fallback"
          />
          <button className="btn btn-primary" type="submit">Send</button>
        </form>
        <div className="flex items-center gap-2 rounded-lg bg-slate-950/60 p-2">
          <span className="text-xs font-semibold text-slate-300">🎭 Demo voice</span>
          <select value={script} onChange={(e) => setScript(e.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs" aria-label="Demo script">
            {Object.entries(DEMO_SCRIPTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {state.demo.running ? (
            <button className="btn btn-ghost !py-1 !text-xs" onClick={() => engine.stopDemo()}>⏹ Stop ({state.demo.index}/{state.demo.total})</button>
          ) : (
            <button className="btn btn-success !py-1 !text-xs" onClick={() => engine.runDemo(script)}>▶ Run</button>
          )}
        </div>
      </div>
    </section>
  );
}
