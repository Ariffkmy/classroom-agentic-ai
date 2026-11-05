"use client";
import type { ClassroomState } from "@/lib/types";
import type { ClassroomEngine } from "@/lib/engine";

const L = ["A", "B", "C", "D", "E"];

export default function QuizPanel({ state, engine }: { state: ClassroomState; engine: ClassroomEngine }) {
  const ss = state.quizSession;
  const quiz = state.quizzes.find((q) => q.id === ss?.quizId);
  if (!ss || !quiz) return null;
  const q = quiz.questions[ss.current];
  const ins = state.insights;
  const total = quiz.questions.length * ss.groups.length;
  const filled = quiz.questions.reduce((a, qq) => a + Object.values(ss.responses[qq.id]).filter((v) => v !== null).length, 0);

  return (
    <section className="card" aria-label="Quiz and class insights">
      <div className="card-h">
        <span>📝 Quiz & class insights — {quiz.title}</span>
        <span className="text-xs font-normal text-slate-400">Response method: teacher-entered group answer cards · no student devices · anonymous groups</span>
      </div>

      {ss.phase === "answering" && (
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {quiz.questions.map((qq, i) => {
              const n = Object.values(ss.responses[qq.id]).filter((v) => v !== null).length;
              return (
                <button key={qq.id} className={`btn !py-1 !text-xs ${i === ss.current ? "btn-primary" : "btn-ghost"}`} onClick={() => engine.setQuizQuestion(i)}>
                  Q{i + 1} <span className="opacity-70">({n}/{ss.groups.length})</span>
                </button>
              );
            })}
            <span className="ml-auto text-xs text-slate-400">{filled}/{total} answers entered</span>
          </div>

          <div className="mt-3 rounded-lg bg-slate-950/60 p-3">
            <div className="text-sm font-semibold text-white">Q{ss.current + 1}. {q.prompt}</div>
            <div className="mt-1 text-xs text-slate-400">
              Key: <b className="text-emerald-300">{L[q.answer]}</b> · {q.options[q.answer]} · objective {q.objective ?? "—"}
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400"><th className="py-1 text-left font-medium">Group</th>{q.options.map((_, i) => <th key={i} className="font-medium">{L[i]}</th>)}</tr>
                </thead>
                <tbody>
                  {ss.groups.map((g) => (
                    <tr key={g} className="border-t border-slate-800">
                      <td className="py-1.5 text-slate-200">{g}</td>
                      {q.options.map((_, i) => {
                        const sel = ss.responses[q.id][g] === i;
                        return (
                          <td key={i} className="text-center">
                            <button
                              className={`h-8 w-8 rounded-md text-xs font-bold transition ${sel ? "bg-indigo-500 text-white ring-2 ring-indigo-300" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                              onClick={() => engine.setResponse(q.id, g, sel ? null : i)}
                              aria-pressed={sel}
                              aria-label={`${g} answered ${L[i]}`}
                            >
                              {L[i]}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-ghost" disabled={ss.current === 0} onClick={() => engine.setQuizQuestion(ss.current - 1)}>← Prev</button>
            <button className="btn btn-ghost" disabled={ss.current >= quiz.questions.length - 1} onClick={() => engine.setQuizQuestion(ss.current + 1)}>Next →</button>
            <button className="btn btn-ghost" onClick={() => engine.simulateResponses()}>🎲 Fill demo group answers</button>
            <button className="btn btn-success ml-auto" disabled={filled === 0} onClick={() => engine.finishQuiz()}>📊 Analyse responses</button>
          </div>
        </div>
      )}

      {ss.phase === "results" && ins && (
        <div className="grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-2 text-sm text-slate-300">
              Overall <b className="text-white">{Math.round(ins.overallRate * 100)}%</b> correct · sample: {ins.sampleSize} groups
            </div>
            <table className="w-full text-xs">
              <thead><tr className="text-slate-400"><th className="text-left font-medium">Question</th><th className="font-medium">Correct</th><th className="font-medium">Most common wrong</th><th className="font-medium">Status</th></tr></thead>
              <tbody>
                {ins.stats.map((s, i) => (
                  <tr key={s.questionId} className="border-t border-slate-800">
                    <td className="py-1.5 pr-2 text-slate-200">Q{i + 1}. {s.prompt}</td>
                    <td className="text-center font-semibold">{s.correct}/{s.responses} ({Math.round(s.rate * 100)}%)</td>
                    <td className="text-center text-slate-400">{s.commonWrong ?? "—"}</td>
                    <td className="text-center">{s.flagged ? <span className="chip bg-amber-500/20 text-amber-200">⚠ Below 60%</span> : <span className="chip bg-emerald-500/15 text-emerald-200">✓ OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-500">{ins.caveat}</p>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg bg-orange-500/10 p-3 ring-1 ring-orange-400/30">
              <div className="text-xs font-semibold uppercase tracking-wide text-orange-200">Assessment agent recommendation</div>
              {ins.weakConcepts.length > 0 && <div className="mt-1 text-xs text-slate-300">Concepts needing review (from response evidence): <b>{ins.weakConcepts.join(", ")}</b></div>}
              <p className="mt-1 text-sm text-slate-100">{ins.recommendation}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ins.followUp && <button className="btn btn-primary" onClick={() => engine.generateFollowUp()}>🎬 Follow-up: {ins.followUp.title}</button>}
              <button className="btn btn-ghost" onClick={() => engine.openQuiz(quiz.id)}>↺ Re-run quiz</button>
              <button className="btn btn-ghost" onClick={() => engine.closeQuiz()}>Close results</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
