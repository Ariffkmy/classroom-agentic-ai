"use client";
import { useMirroredClassroom } from "@/hooks/useClassroom";
import { ScaledStage } from "@/components/Stage";

export default function DisplayPage() {
  const { state, send } = useMirroredClassroom();
  if (!state)
    return (
      <div className="stage-bg flex h-screen flex-col items-center justify-center gap-4 text-center text-white">
        <div className="text-7xl">🎓</div>
        <div className="text-3xl font-bold">Classroom display</div>
        <p className="max-w-md text-slate-300">Waiting for the teacher dashboard… Open <code className="rounded bg-white/10 px-1">/teacher</code> in another tab or window of this browser.</p>
      </div>
    );
  return (
    <div className="group relative h-screen w-screen bg-black">
      <ScaledStage state={state} className="h-full w-full" />
      {/* Teacher can also stop content directly from the projector screen */}
      <div className="absolute bottom-12 right-4 flex gap-2 opacity-0 transition group-hover:opacity-100">
        {state.presentation.mode === "content" && (
          <button className="btn btn-ghost" onClick={() => send(state.presentation.playing ? "pause" : "resume")}>{state.presentation.playing ? "⏸" : "▶"}</button>
        )}
        {state.presentation.mode !== "idle" && <button className="btn btn-danger" onClick={() => send("dismiss")}>✕ Dismiss</button>}
        <button className="btn btn-ghost" onClick={() => document.documentElement.requestFullscreen?.()}>⛶ Fullscreen</button>
      </div>
    </div>
  );
}
