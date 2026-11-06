"use client";
import type { ClassroomState, GenerationTask } from "@/lib/types";
import type { ClassroomEngine } from "@/lib/engine";
import { CheckRow, StatusBadge } from "./ui";

const FLOW = ["planned", "generating", "validating", "ready", "presented"] as const;

function Stepper({ t }: { t: GenerationTask }) {
  const idx = FLOW.indexOf(t.status as (typeof FLOW)[number]);
  const bad = ["failed", "held", "cancelled"].includes(t.status);
  return (
    <ol className="flex items-center gap-1 text-[10px]" aria-label="Task progress">
      {FLOW.map((f, i) => {
        const done = !bad && idx >= i;
        const current = !bad && idx === i;
        return (
          <li key={f} className="flex items-center gap-1">
            <span className={`rounded px-1.5 py-0.5 capitalize ${current ? "bg-indigo-500 text-white" : done ? "bg-indigo-500/30 text-indigo-100" : "bg-slate-800 text-slate-500"}`}>{f}</span>
            {i < FLOW.length - 1 && <span className="text-slate-600">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default function PipelinePanel({ state, engine }: { state: ClassroomState; engine: ClassroomEngine }) {
  const tasks = state.tasks;
  return (
    <section className="card flex min-h-0 flex-col" aria-label="Content generation pipeline">
      <div className="card-h">
        <span>🎬 Autonomous content studio <span className="font-normal text-slate-400">(background workers)</span></span>
        <span className="text-xs font-normal text-slate-400">{tasks.filter((t) => ["planned", "generating", "validating"].includes(t.status)).length} running</span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {tasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            No tasks yet. When the AI decides a visual, story or quiz would help, it appears here and is generated in the background — teaching is never blocked.
          </div>
        )}
        {tasks.map((t) => {
          const asset = state.assets.find((a) => a.id === t.assetId);
          const running = ["planned", "generating", "validating"].includes(t.status);
          const waiting = state.presentation.waitingAssetId && state.presentation.waitingAssetId === t.assetId;
          return (
            <article key={t.id} className={`slide-in rounded-xl border p-3 ${t.status === "failed" || t.status === "held" ? "border-rose-500/40 bg-rose-950/20" : "border-slate-800 bg-slate-950/50"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{t.title}</span>
                    <span className="chip bg-slate-800 capitalize text-slate-300">{t.format}</span>
                    {t.isFallbackFor && <span className="chip bg-amber-500/15 text-amber-200">fallback</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {t.requestedBy === "agent" ? "🤖 AI decided" : "👩‍🏫 Teacher asked"} · {t.reason}
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </div>

              <div className="mt-2"><Stepper t={t} /></div>

              {running && (
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5"><span className="spinner !h-3 !w-3 !border-2" /> {t.stage}</span>
                    <span>{t.progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 transition-all duration-300" style={{ width: `${t.progress}%` }} />
                  </div>
                </div>
              )}
              {!running && <div className={`mt-2 text-xs ${t.error ? "text-rose-300" : "text-slate-400"}`}>{t.error ?? t.stage}{waiting && " ⏳"}</div>}

              {t.checks.length > 0 && t.status !== "planned" && t.status !== "generating" && (
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  {t.checks.map((c) => <CheckRow key={c.name} c={c} />)}
                </ul>
              )}

              <details className="mt-2 text-xs text-slate-400">
                <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-300">Content brief</summary>
                <p className="mt-1">{t.brief}</p>
                {asset && <p className="mt-1 text-slate-500">Asset: {asset.scenes.length} scenes · written by: {asset.provider}</p>}
              </details>

              {asset?.reel && (
                <details className="mt-2 text-xs text-slate-400">
                  <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-300">Script (written from the lesson, read-only)</summary>
                  <ol className="mt-1 list-decimal space-y-1 pl-4">
                    {asset.scenes.map((sc, i) => <li key={i}>{sc.narration}</li>)}
                  </ol>
                </details>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                {running && <button className="btn btn-ghost !py-1 !text-xs" onClick={() => engine.cancelTask(t.id)}>Cancel</button>}
                {(t.status === "failed" || t.status === "held") && <button className="btn btn-ghost !py-1 !text-xs" onClick={() => engine.retryTask(t.id)}>↻ Retry</button>}
                {asset && (t.status === "ready" || t.status === "presented") && (
                  <button className="btn btn-primary !py-1 !text-xs" onClick={() => engine.presentAsset(asset.id)}>
                    {t.status === "presented" ? "↺ Present again" : "▶ Present now"}
                  </button>
                )}
                {asset && t.kind === "content" && !t.isFallbackFor && t.status !== "held" && (
                  <button className="btn btn-ghost !py-1 !text-xs" onClick={() => engine.requestRevision(asset.id)}>↻ Make a different version</button>
                )}
                {t.kind === "quiz" && t.quizId && t.status === "ready" && (
                  <button className="btn btn-primary !py-1 !text-xs" onClick={() => engine.openQuiz(t.quizId!)}>▶ Start quiz</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
