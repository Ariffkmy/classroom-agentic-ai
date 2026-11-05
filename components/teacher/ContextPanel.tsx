"use client";
import type { ClassroomState } from "@/lib/types";
import type { ClassroomEngine } from "@/lib/engine";
import { TOPICS } from "@/lib/curriculum";

const STATUS_TEXT: Record<string, { t: string; cls: string }> = {
  listening: { t: "Listening for lesson context…", cls: "text-slate-300" },
  uncertain: { t: "Forming a hypothesis — not confident yet", cls: "text-amber-300" },
  general: { t: "General context (subject unclear)", cls: "text-amber-300" },
  confident: { t: "Lesson context identified", cls: "text-emerald-300" },
};

export default function ContextPanel({ state, engine }: { state: ClassroomState; engine: ClassroomEngine }) {
  const c = state.context;
  const cur = state.curriculum;
  const pct = Math.round(c.confidence * 100);
  const st = STATUS_TEXT[c.status];
  const ranked = Object.entries(c.scores).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <section className="card" aria-label="AI lesson understanding">
      <div className="card-h">
        <span>🧠 AI&apos;s understanding of the lesson</span>
        <span className={`text-xs font-normal ${st.cls}`}>{st.t}</span>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="grid grid-cols-[80px_1fr] gap-y-1.5 text-sm">
            <span className="text-slate-400">Subject</span>
            <span className="font-semibold text-white">{c.subject ?? <i className="font-normal text-slate-500">detecting…</i>}</span>
            <span className="text-slate-400">Topic</span>
            <span className="font-semibold text-white">{c.topic ?? <i className="font-normal text-slate-500">detecting…</i>}</span>
            <span className="text-slate-400">Level</span>
            <span className="text-slate-200">{c.level ?? "—"} {c.level && <span className="text-xs text-slate-500">(inferred)</span>}</span>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>Confidence</span>
              <span className="font-semibold text-slate-200">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full transition-all duration-700 ${pct >= 50 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
            </div>
            {ranked.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-slate-500">
                Evidence: {ranked.map(([k, v]) => <span key={k} className="rounded bg-slate-800 px-1.5">{TOPICS.find((t) => t.id === k)?.topic ?? k} {v.toFixed(1)}</span>)}
              </div>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-400">Concepts detected</div>
            <div className="flex flex-wrap gap-1.5">
              {c.concepts.length ? c.concepts.map((k) => <span key={k} className="chip slide-in bg-sky-500/15 text-sky-100 ring-1 ring-sky-400/30">{k}</span>) : <span className="text-xs text-slate-500">—</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <label htmlFor="correct">Correct the AI (optional):</label>
            <select id="correct" className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-200" value={c.topicId ?? ""} onChange={(e) => engine.correctTopic(e.target.value)}>
              <option value="" disabled>—</option>
              {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.subject}: {t.topic}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>📚 Curriculum mapping</span>
              {cur && (
                <span className={`chip ${cur.verified ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>
                  {cur.verified ? "✓ From configured source" : "⚠ Unverified"}
                </span>
              )}
            </div>
            {cur ? (
              <div className="rounded-lg bg-slate-950/60 p-2.5 text-xs">
                <div className="font-semibold text-slate-100">{cur.curriculum} · {cur.level}</div>
                <div className="text-slate-300">{cur.unit}</div>
                <ul className="mt-1.5 space-y-1">
                  {cur.objectives.map((o) => (
                    <li key={o.code} className="flex gap-2 text-slate-300"><span className="font-mono text-teal-300">{o.code}</span><span>{o.text}</span></li>
                  ))}
                </ul>
                <div className="mt-1.5 text-[10px] text-slate-500">Source: {cur.source}</div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-700 p-2.5 text-xs text-slate-500">Waiting for a confident topic before retrieving curriculum — the AI never invents references.</div>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-400">📝 Rolling lesson summary</div>
            <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-slate-300">
              {c.summary.length ? c.summary.map((s, i) => <li key={i} className="slide-in">• {s}</li>) : <li className="text-slate-500">—</li>}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
