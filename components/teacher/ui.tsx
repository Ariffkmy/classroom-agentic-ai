"use client";
import type { AgentName, TaskStatus, ValidationCheck } from "@/lib/types";

export const AGENT_STYLE: Record<AgentName, string> = {
  Orchestrator: "bg-indigo-500/20 text-indigo-200 ring-indigo-400/40",
  Listening: "bg-sky-500/20 text-sky-200 ring-sky-400/40",
  Curriculum: "bg-teal-500/20 text-teal-200 ring-teal-400/40",
  Content: "bg-fuchsia-500/20 text-fuchsia-200 ring-fuchsia-400/40",
  Validator: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40",
  Voice: "bg-amber-500/20 text-amber-200 ring-amber-400/40",
  Quiz: "bg-violet-500/20 text-violet-200 ring-violet-400/40",
  Assessment: "bg-orange-500/20 text-orange-200 ring-orange-400/40",
  System: "bg-slate-500/20 text-slate-300 ring-slate-400/40",
};

export function AgentTag({ agent }: { agent: AgentName }) {
  return <span className={`chip ring-1 ${AGENT_STYLE[agent]}`}>{agent}</span>;
}

export const STATUS_STYLE: Record<TaskStatus, { label: string; cls: string; icon: string }> = {
  planned: { label: "Planned", cls: "bg-slate-600/40 text-slate-200", icon: "🗒" },
  generating: { label: "Generating", cls: "bg-fuchsia-600/30 text-fuchsia-100", icon: "⚙️" },
  validating: { label: "Validating", cls: "bg-sky-600/30 text-sky-100", icon: "🔎" },
  ready: { label: "Ready", cls: "bg-emerald-600/30 text-emerald-100", icon: "✅" },
  presented: { label: "Presented", cls: "bg-indigo-600/40 text-indigo-100", icon: "📺" },
  held: { label: "Held back", cls: "bg-amber-600/30 text-amber-100", icon: "✋" },
  failed: { label: "Failed", cls: "bg-rose-600/30 text-rose-100", icon: "⚠️" },
  cancelled: { label: "Cancelled", cls: "bg-slate-700/60 text-slate-300", icon: "⨯" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`chip ${s.cls}`}>
      <span aria-hidden>{s.icon}</span> {s.label}
    </span>
  );
}

export function CheckRow({ c }: { c: ValidationCheck }) {
  const icon = { pending: "○", running: "", pass: "✓", fail: "✗", warn: "!" }[c.status];
  const cls = { pending: "text-slate-500", running: "text-sky-300", pass: "text-emerald-300", fail: "text-rose-300", warn: "text-amber-300" }[c.status];
  return (
    <li className="flex items-start gap-2 text-xs">
      <span className={`mt-0.5 w-4 text-center font-bold ${cls}`} aria-label={c.status}>
        {c.status === "running" ? <span className="spinner !h-3 !w-3 !border-2" /> : icon}
      </span>
      <span className="flex-1">
        <span className={c.status === "fail" ? "text-rose-200" : "text-slate-200"}>{c.name}</span>
        {c.detail && <span className="block text-slate-400">{c.detail}</span>}
      </span>
    </li>
  );
}

export function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-1.5">
      <span>
        <span className="text-sm font-medium text-slate-200">{label}</span>
        {desc && <span className="block text-xs text-slate-400">{desc}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-indigo-500" : "bg-slate-700"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? "left-5" : "left-0.5"}`} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </label>
  );
}

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
