"use client";
// Shows what the agent is trying to do, what it decided, why, and how that turned out.

import type { AgentDecision, ClassroomState, ConceptEvidence } from "@/lib/types";
import type { ClassroomEngine } from "@/lib/engine";
import { ACTION_LABEL, AGENT_GOAL, firstRate, latestRate, PASS_RATE } from "@/lib/agent/brain";
import { fmtTime } from "./ui";

const STATUS: Record<AgentDecision["status"], { label: string; cls: string }> = {
  running: { label: "In progress", cls: "bg-sky-600/30 text-sky-100" },
  done: { label: "Done", cls: "bg-emerald-600/30 text-emerald-100" },
  blocked: { label: "Blocked", cls: "bg-amber-600/30 text-amber-100" },
  failed: { label: "Failed", cls: "bg-rose-600/30 text-rose-100" },
  skipped: { label: "Cancelled", cls: "bg-slate-700/60 text-slate-300" },
};

function Evidence({ e }: { e: ConceptEvidence }) {
  const latest = Math.round(latestRate(e) * 100);
  const first = Math.round(firstRate(e) * 100);
  const passed = latestRate(e) >= PASS_RATE;
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="min-w-0 flex-1 truncate text-slate-300" title={e.concept}>{e.concept.replace(/-/g, " ")}</span>
      {e.attempts.length > 1 && <span className="text-slate-500">{first}% →</span>}
      <span className={`font-semibold ${passed ? "text-emerald-300" : "text-amber-300"}`}>{latest}%</span>
    </li>
  );
}

function Decision({ d }: { d: AgentDecision }) {
  const s = STATUS[d.status];
  return (
    <li className="rounded-lg bg-slate-950/60 p-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-white">{ACTION_LABEL[d.action]}</span>
        {d.action !== "wait" && <span className={`chip ${s.cls}`}>{s.label}</span>}
        <span className={`chip ${d.source === "model" ? "bg-indigo-500/20 text-indigo-200" : "bg-slate-700/60 text-slate-300"}`}>{d.source === "model" ? "AI decided" : "Fixed rule"}</span>
        <span className="ml-auto text-slate-500">{fmtTime(d.t)}</span>
      </div>
      {d.focus && <p className="mt-1 text-slate-300">Focus: {d.focus}</p>}
      <p className="mt-1 text-slate-300">{d.reason}</p>
      {d.expected && <p className="mt-1 text-slate-400">Expected: {d.expected}</p>}
      {d.outcome && <p className="mt-1 text-slate-400">Result: {d.outcome}</p>}
      {d.reflection && <p className="mt-1 text-indigo-200">Looking back: {d.reflection}</p>}
    </li>
  );
}

export default function AgentPanel({ state, engine }: { state: ClassroomState; engine: ClassroomEngine }) {
  const { agent } = state;
  const usesModel = state.aiProvider.llm;
  // Waiting is often right, but a long run of it would bury the decisions that did something.
  const shown = [...agent.decisions].reverse().filter((d, i, all) => d.action !== "wait" || all[i - 1]?.action !== "wait").slice(0, 8);
  return (
    <section className="card flex min-h-0 flex-col" aria-label="Lesson agent">
      <div className="card-h">
        <span>🧭 Lesson agent</span>
        <span className="text-xs font-normal text-slate-400">
          {agent.thinking ? "Deciding…" : usesModel ? "AI decides" : "Offline: fixed rules decide"}
        </span>
      </div>
      <div className="min-h-0 space-y-3 overflow-y-auto p-3">
        <p className="text-xs text-slate-400"><b className="font-semibold text-slate-200">Goal:</b> {AGENT_GOAL}</p>

        {agent.lessonPlan && (
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-200">Plan for this lesson</div>
            <ol className="space-y-1">
              {agent.lessonPlan.steps.map((p, i) => (
                <li key={i} className={`flex gap-2 text-xs ${p.status === "done" ? "text-emerald-300" : p.status === "doing" ? "font-semibold text-white" : p.status === "dropped" ? "text-slate-500 line-through" : "text-slate-300"}`}>
                  <span aria-hidden className="w-4 shrink-0 text-center">{p.status === "done" ? "✓" : p.status === "doing" ? "▶" : p.status === "dropped" ? "✕" : "○"}</span>
                  <span>{p.text}<span className="sr-only"> ({p.status})</span></span>
                </li>
              ))}
            </ol>
            {agent.lessonPlan.changes.slice(-1).map((c) => <p key={c.t} className="mt-1 text-xs text-indigo-200">Changed: {c.why}</p>)}
          </div>
        )}

        {agent.advice && (
          <div className="flex items-start gap-2 rounded-lg bg-orange-500/10 p-2.5 text-xs text-orange-100 ring-1 ring-orange-400/30">
            <p className="flex-1"><b>For you only:</b> {agent.advice}</p>
            <button className="text-orange-200 hover:text-white" onClick={() => engine.clearAdvice()} aria-label="Dismiss advice">✕</button>
          </div>
        )}

        {agent.evidence.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-200">Understanding by concept <span className="font-normal text-slate-500">(groups, first → latest)</span></div>
            <ul className="space-y-1">{agent.evidence.map((e) => <Evidence key={e.concept} e={e} />)}</ul>
          </div>
        )}

        {shown.length > 0 ? (
          <ul className="space-y-2">{shown.map((d) => <Decision key={d.id} d={d} />)}</ul>
        ) : (
          <p className="text-xs text-slate-500">No decisions yet. The agent starts once it knows the topic.</p>
        )}
      </div>
    </section>
  );
}
