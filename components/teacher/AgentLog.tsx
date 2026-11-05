"use client";
import type { ClassroomState } from "@/lib/types";
import { AgentTag, fmtTime } from "./ui";

const KIND_ICON = { info: "•", decision: "◆", success: "✓", warning: "!", error: "✗" } as const;
const KIND_CLS = { info: "text-slate-400", decision: "text-indigo-300", success: "text-emerald-300", warning: "text-amber-300", error: "text-rose-300" } as const;

export default function AgentLog({ state }: { state: ClassroomState }) {
  const items = [...state.log].reverse().slice(0, 120);
  return (
    <section className="card flex min-h-0 flex-col" aria-label="Agent activity">
      <div className="card-h">
        <span>🛰 Agent activity <span className="font-normal text-slate-400">(orchestrator trace)</span></span>
        <span className="text-xs font-normal text-slate-500">◆ = autonomous decision</span>
      </div>
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
        {items.length === 0 && <li className="text-sm text-slate-500">Agents are idle.</li>}
        {items.map((e) => (
          <li key={e.id} className="slide-in text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-3 text-center font-bold ${KIND_CLS[e.kind]}`} aria-label={e.kind}>{KIND_ICON[e.kind]}</span>
              <AgentTag agent={e.agent} />
              <span className="text-[10px] text-slate-500">{fmtTime(e.t)}</span>
            </div>
            <div className={`ml-5 mt-0.5 ${e.kind === "decision" ? "font-medium text-indigo-100" : "text-slate-300"}`}>{e.message}</div>
            {e.detail && <div className="ml-5 text-slate-500">{e.detail}</div>}
          </li>
        ))}
      </ol>
    </section>
  );
}
