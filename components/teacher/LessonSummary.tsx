"use client";
import type { ClassroomState } from "@/lib/types";
import type { ClassroomEngine } from "@/lib/engine";
import { ACTION_LABEL, firstRate, latestRate } from "@/lib/agent/brain";

export default function LessonSummary({ state, engine, onClose }: { state: ClassroomState; engine: ClassroomEngine; onClose: () => void }) {
  const mins = state.lesson.startedAt && state.lesson.endedAt ? Math.max(1, Math.round((state.lesson.endedAt - state.lesson.startedAt) / 60000)) : 0;
  const presented = state.assets.filter((a) => a.presentedAt);
  const ins = state.insights;
  const acted = state.agent.decisions.filter((d) => d.action !== "wait" && d.status !== "blocked");

  const exportJson = () => {
    // Data minimisation: no raw audio, no student names — only summaries & aggregates.
    const data = {
      lesson: state.lesson,
      inferred: { subject: state.context.subject, topic: state.context.topic, level: state.context.level, topicHistory: state.context.topicHistory },
      curriculum: state.curriculum,
      summary: state.context.summary,
      generatedContent: state.assets.map((a) => ({ id: a.id, title: a.title, format: a.format, objectives: a.objectives.map((o) => o.code), validation: a.validation, presentedAt: a.presentedAt })),
      assessment: ins && { overallRate: ins.overallRate, sampleSize: ins.sampleSize, stats: ins.stats.map(({ questionId, correct, responses }) => ({ questionId, correct, responses })), weakConcepts: ins.weakConcepts },
      understanding: state.agent.evidence,
      agentDecisions: state.agent.decisions.map(({ t, trigger, action, focus, reason, expected, source, status, outcome, reflection }) => ({ t, trigger, action, focus, reason, expected, source, status, outcome, reflection })),
      teacherActions: state.teacherActions,
      retention: "Raw audio never stored. Transcript discarded; summary retained for this session only.",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lesson-summary-${state.lesson.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Lesson summary">
      <div className="pop max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-indigo-300">Lesson ended</div>
            <h2 className="text-2xl font-extrabold text-white">{state.context.topic ?? "Lesson"} summary</h2>
            <div className="text-sm text-slate-400">{state.context.subject} · {state.context.level} · {mins} min</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-800 p-3"><div className="text-2xl font-bold text-white">{state.context.concepts.length}</div><div className="text-xs text-slate-400">concepts covered</div></div>
          <div className="rounded-xl bg-slate-800 p-3"><div className="text-2xl font-bold text-white">{presented.length}</div><div className="text-xs text-slate-400">AI items presented</div></div>
          <div className="rounded-xl bg-slate-800 p-3"><div className="text-2xl font-bold text-white">{ins ? `${Math.round(ins.overallRate * 100)}%` : "—"}</div><div className="text-xs text-slate-400">quiz (groups)</div></div>
        </div>
        <h3 className="mt-5 text-sm font-semibold text-slate-200">Rolling summary</h3>
        <ul className="mt-1 space-y-1 text-sm text-slate-300">{state.context.summary.map((s, i) => <li key={i}>• {s}</li>)}</ul>
        {state.agent.evidence.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold text-slate-200">Understanding by concept</h3>
            <ul className="mt-1 space-y-1 text-sm text-slate-300">
              {state.agent.evidence.map((e) => (
                <li key={e.concept}>
                  • {e.concept.replace(/-/g, " ")}: {e.attempts.length > 1 ? `${Math.round(firstRate(e) * 100)}% → ${Math.round(latestRate(e) * 100)}%` : `${Math.round(latestRate(e) * 100)}%`} <span className="text-slate-500">({e.attempts.length} {e.attempts.length === 1 ? "check" : "checks"})</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-slate-500">Group answers from this lesson. A guide for the teacher, not a controlled measure of learning.</p>
          </>
        )}
        {acted.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold text-slate-200">What the agent did</h3>
            <ul className="mt-1 space-y-1 text-sm text-slate-300">
              {acted.map((d) => <li key={d.id}>• {ACTION_LABEL[d.action]}: {d.outcome ?? d.reason}</li>)}
            </ul>
          </>
        )}
        {state.curriculum && (
          <>
            <h3 className="mt-4 text-sm font-semibold text-slate-200">Learning standards addressed</h3>
            <ul className="mt-1 space-y-1 text-sm text-slate-300">{state.curriculum.objectives.map((o) => <li key={o.code}><span className="font-mono text-teal-300">{o.code}</span> {o.text}</li>)}</ul>
          </>
        )}
        {ins && ins.weakConcepts.length > 0 && (
          <div className="mt-4 rounded-lg bg-orange-500/10 p-3 text-sm text-orange-100 ring-1 ring-orange-400/30">
            <b>Next lesson suggestion:</b> {ins.recommendation}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500">Privacy: raw audio was never stored; no student names or faces were processed. Only this summary and class-level results are kept, on this device, until you reset.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={exportJson}>⬇ Export summary (JSON)</button>
          <button className="btn btn-ghost" onClick={() => { engine.reset(); onClose(); }}>Delete lesson data</button>
          <button className="btn btn-ghost" onClick={() => { engine.startLesson(); onClose(); }}>Start new lesson</button>
        </div>
      </div>
    </div>
  );
}
