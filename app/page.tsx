import Link from "next/link";

const STEPS = [
  ["▶ Start lesson", "No subject, year or topic is entered. The AI starts listening."],
  ["🗣 Teach naturally", "Speak into the mic — or press “Run” on the Pythagoras demo voice."],
  ["🧠 AI discovers context", "Subject, topic, concepts and KSSM learning standards appear on their own."],
  ["🎬 AI decides & generates", "It plans a ladder-and-wall animation and renders it in the background while you keep teaching."],
  ["✅ Auto-validated", "Seven automated checks run, including a maths and fact check. Only content that passes is shown — at a natural pause."],
  ["📝 Quiz & group answers", "“Hey assistant, prepare five questions.” Groups hold up answer cards; teacher taps them in."],
  ["📊 Insights & follow-up", "Class-level analysis flags the tricky concept and auto-creates a follow-up animation."],
];

export default function Home() {
  return (
    <main className="stage-bg min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex items-center gap-3 text-indigo-200">
          <span className="text-4xl">🎓</span>
          <span className="text-sm font-semibold uppercase tracking-[0.25em]">Agentic AI · Edutainment · Smart Classroom</span>
        </div>
        <h1 className="mt-6 max-w-4xl text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
          A teaching assistant that <span className="bg-gradient-to-r from-sky-300 to-fuchsia-300 bg-clip-text text-transparent">listens like a student</span>, thinks like an assistant, speaks like a tutor and creates like a studio.
        </h1>
        <p className="mt-6 max-w-3xl text-lg text-slate-300">
          The teacher just teaches. Specialist AI agents work out the subject and topic, map it to the curriculum, autonomously generate and validate an animation, present it at the right moment, run a group quiz and recommend what to re-teach — while the teacher stays in control.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/teacher" className="btn btn-primary !px-5 !py-3 !text-base">👩‍🏫 Open teacher dashboard</Link>
          <a href="/display" target="asc-display" className="btn btn-ghost !px-5 !py-3 !text-base">📺 Open classroom display</a>
          <Link href="/architecture" className="btn btn-ghost !px-5 !py-3 !text-base">🧩 How it works</Link>
        </div>
        <p className="mt-3 text-sm text-slate-400">Tip: put the classroom display on the projector (second window) and keep the dashboard on the teacher&apos;s laptop. Both sync instantly.</p>

        <h2 className="mt-14 text-sm font-semibold uppercase tracking-widest text-indigo-200">3-minute judge demo</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="text-xs text-slate-400">Step {i + 1}</div>
              <div className="mt-1 font-bold">{t}</div>
              <div className="mt-1 text-sm text-slate-300">{d}</div>
            </li>
          ))}
          <li className="rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-400/30">
            <div className="text-xs text-amber-200">Bonus</div>
            <div className="mt-1 font-bold">⚠ Failure drill</div>
            <div className="mt-1 text-sm text-slate-300">Arm “Video provider fails” or “Content fails a check” in Teacher controls to show safe fallbacks.</div>
          </li>
        </ol>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            ["🔒 Privacy by design", "Visible mic status. No raw audio stored. No cameras, faces or student names — anonymous groups only."],
            ["🧑‍🏫 Teacher in control", "Pause listening, dismiss, revise, cancel or disable autonomy at any time. Keyboard shortcuts included."],
            ["🛡 Guardrails", "Automated relevance, curriculum, age, quality, safety and integrity checks before anything reaches students."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-black/30 p-5 ring-1 ring-white/10">
              <div className="font-bold">{t}</div>
              <div className="mt-1 text-sm text-slate-300">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
