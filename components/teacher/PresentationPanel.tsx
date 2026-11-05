"use client";
import type { ClassroomState } from "@/lib/types";
import type { ClassroomEngine } from "@/lib/engine";
import { ScaledStage } from "../Stage";

export default function PresentationPanel({ state, engine }: { state: ClassroomState; engine: ClassroomEngine }) {
  const p = state.presentation;
  const asset = state.assets.find((a) => a.id === p.assetId);
  const waiting = state.assets.find((a) => a.id === p.waitingAssetId);
  return (
    <section className="card" aria-label="Classroom display">
      <div className="card-h">
        <span>📺 Classroom display <span className="font-normal text-slate-400">(live mirror)</span></span>
        <span className="chip bg-slate-800 capitalize text-slate-300">{p.mode === "idle" ? "standby" : p.mode}</span>
      </div>
      <div className="p-3">
        <ScaledStage state={state} className="aspect-video w-full rounded-xl ring-1 ring-slate-700" />
        {waiting && p.mode === "idle" && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-indigo-500/10 p-2 text-xs text-indigo-100 ring-1 ring-indigo-400/30">
            <span>⏳ “{waiting.title}” is ready — waiting for a natural pause so the AI doesn&apos;t interrupt you.</span>
            <button className="btn btn-primary !py-1 !text-xs" onClick={() => engine.presentAsset(waiting.id)}>Present now</button>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {p.mode === "content" && (
            <>
              <button className="btn btn-ghost !text-xs" onClick={() => engine.gotoScene(-1)} aria-label="Previous scene">⏮</button>
              {p.playing ? (
                <button className="btn btn-ghost !text-xs" onClick={() => engine.pausePresentation()}>⏸ Pause</button>
              ) : (
                <button className="btn btn-primary !text-xs" onClick={() => engine.resumePresentation()}>▶ Resume</button>
              )}
              <button className="btn btn-ghost !text-xs" onClick={() => engine.gotoScene(1)} aria-label="Next scene">⏭</button>
              <span className="text-xs text-slate-400">Scene {p.scene + 1}/{asset?.scenes.length}</span>
              <button className="btn btn-ghost !text-xs" onClick={() => engine.requestRevision(p.assetId)}>✎ Revise</button>
            </>
          )}
          {p.mode !== "idle" && (
            <button className="btn btn-danger ml-auto !text-xs" onClick={() => (p.mode === "quiz" || p.mode === "results" ? engine.closeQuiz() : engine.dismiss())}>✕ Dismiss</button>
          )}
          {p.mode === "idle" && <span className="text-xs text-slate-500">Standby screen shown to students. Content appears here automatically once it passes all checks.</span>}
        </div>
      </div>
    </section>
  );
}
