import Link from "next/link";

const AGENTS = [
  ["Listening Agent", "Transcript → subject, topic, concepts, topic changes, rolling summary, direct-address detection.", "lib/agents/listening.ts", "sky"],
  ["Curriculum Agent", "Maps topic to learning standards from a configured source; labels anything else UNVERIFIED.", "lib/curriculum.ts", "teal"],
  ["Content Agent", "Decides format, writes brief, storyboard & narration; runs in background workers.", "lib/engine.ts › runContentTask", "fuchsia"],
  ["Validator", "Relevance · curriculum · age · educational quality · safety & bias · technical integrity.", "lib/agents/validator.ts", "emerald"],
  ["Voice Agent", "Speaks only in pauses, reports progress, answers teacher requests.", "lib/voice.ts", "amber"],
  ["Quiz Agent", "Generates & validates multiple-choice questions mapped to objectives.", "lib/engine.ts › prepareQuiz", "violet"],
  ["Assessment Agent", "Class/group-level stats, flags < 60% questions, recommends follow-ups. No individual judgements.", "lib/agents/assessment.ts", "orange"],
];

const TESTS = [
  ["AT-01", "Start lesson without a subject", "Press Start lesson"],
  ["AT-02/03", "Topic & concept detection", "Run Pythagoras demo voice; watch AI understanding panel"],
  ["AT-04/05/06", "Autonomous generation → checks → auto present", "After “a² + b² = c²”, a task appears, validates, then plays at a pause"],
  ["AT-07", "Failed check → held + fallback", "Teacher controls › Failure drill › Content fails a check"],
  ["AT-08", "Dismiss stops presentation", "✕ Dismiss or Esc"],
  ["AT-09", "Teacher requests quiz", "“Hey assistant, prepare five questions…”"],
  ["AT-10/11", "Group results & follow-up", "Fill demo group answers → Analyse responses"],
  ["AT-12", "Video service fails", "Failure drill › Video provider fails"],
  ["AT-13", "Pause listening", "⏸ Pause listening — mic badge turns grey"],
];

export default function Architecture() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-200">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-indigo-300 hover:underline">← Home</Link>
        <h1 className="mt-3 text-4xl font-extrabold text-white">How it works</h1>
        <p className="mt-2 max-w-3xl text-slate-400">A central orchestrator receives <i>meaningful</i> lesson events — final transcript segments, teacher commands, UI actions — not raw audio packets. Slow generation runs in background workers so the live lesson is never blocked.</p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto_1.4fr_auto_1fr] lg:items-center">
          <div className="card p-4">
            <div className="font-bold text-white">🎙 Realtime voice layer</div>
            <p className="mt-1 text-sm text-slate-400">Browser speech-to-text (swappable for a realtime voice API). Interim captions shown live; only final segments go to the orchestrator. Text & demo-voice fallbacks.</p>
          </div>
          <div className="hidden text-3xl text-slate-600 lg:block">→</div>
          <div className="card border-indigo-500/50 p-4">
            <div className="font-bold text-indigo-200">🛰 AI Orchestrator</div>
            <p className="mt-1 text-sm text-slate-400">Holds lesson state, infers context, decides when content would help (with frequency limits), delegates to agents, tracks task status, handles failures & retries, publishes only validated content at natural pauses.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {AGENTS.map(([n]) => <div key={n} className="rounded-lg bg-slate-800 px-2 py-1 text-xs">{n}</div>)}
            </div>
          </div>
          <div className="hidden text-3xl text-slate-600 lg:block">→</div>
          <div className="card p-4">
            <div className="font-bold text-white">📺 Classroom display</div>
            <p className="mt-1 text-sm text-slate-400">Separate projector window synced in real time; teacher dashboard mirrors it and keeps pause / dismiss / revise controls.</p>
          </div>
        </div>

        <h2 className="mt-10 text-xl font-bold text-white">Agents & guardrails</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {AGENTS.map(([n, d, f]) => (
            <div key={n} className="card p-4">
              <div className="font-semibold text-white">{n}</div>
              <div className="mt-1 text-sm text-slate-400">{d}</div>
              <div className="mt-2 font-mono text-[11px] text-slate-500">{f}</div>
            </div>
          ))}
          <div className="card p-4">
            <div className="font-semibold text-white">🧠 Language model (optional)</div>
            <div className="mt-1 text-sm text-slate-400">With <code>ANTHROPIC_API_KEY</code> set on the server, the agents use Claude to answer free-form questions and to handle topics outside the curriculum dataset (labelled unverified). Without it, deterministic on-device agents keep the demo 100% reliable offline.</div>
            <div className="mt-2 font-mono text-[11px] text-slate-500">app/api/ai/route.ts</div>
          </div>
        </div>

        <h2 className="mt-10 text-xl font-bold text-white">MVP acceptance tests — how to demonstrate</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {TESTS.map(([id, t, how]) => (
              <tr key={id} className="border-t border-slate-800">
                <td className="py-2 pr-3 font-mono text-indigo-300">{id}</td>
                <td className="pr-3 text-slate-200">{t}</td>
                <td className="text-slate-400">{how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
