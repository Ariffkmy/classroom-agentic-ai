"use client";
import { useEffect, useRef } from "react";
import type { ClassroomState } from "@/lib/types";
import type { ClassroomEngine } from "@/lib/engine";
import { PASS_RATE } from "@/lib/agent/brain";

const L = ["A", "B", "C", "D"];

export default function ChallengePanel({ state, engine }: { state: ClassroomState; engine: ClassroomEngine }) {
  const ss = state.challengeSession;
  const panel = useRef<HTMLElement>(null);
  // A challenge can start by itself, and it waits for answers here, so bring this into view.
  useEffect(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [ss?.challengeId]);
  const c = state.challenges.find((x) => x.id === ss?.challengeId);
  if (!ss || !c) return null;
  const step = c.steps[ss.step];
  const easier = ss.phase === "support" || ss.phase === "supportReveal";
  const q = easier && step.support ? step.support : step;
  const answering = ss.phase === "answering" || ss.phase === "support";
  const entered = Object.values(ss.responses).filter((v) => v !== null).length;

  return (
    <section ref={panel} className="card" aria-label="Class Challenge">
      <div className="card-h">
        <span>🗺 Class Challenge — {c.title}</span>
        <span className="text-xs font-normal text-slate-400">Step {ss.step + 1} of {c.steps.length}{easier ? " · easier try" : ""}</span>
      </div>
      <div className="p-4">
        {ss.phase === "done" ? (
          <>
            <ul className="space-y-1 text-sm text-slate-200">
              {ss.results.map((r, i) => (
                <li key={r.stepId}>
                  Step {i + 1}: <b>{Math.round(r.rate * 100)}%</b> first try{r.supportRate !== undefined ? `, ${Math.round(r.supportRate * 100)}% on the easier try` : ""} · <span className="text-slate-400">{r.concept.replace(/-/g, " ")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">Results describe the class as groups and say nothing about any individual student.</p>
            <button className="btn btn-ghost mt-3" onClick={() => engine.closeChallenge()}>Close challenge</button>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold text-white">{q === step ? step.question : step.support?.question}</div>
            <div className="mt-1 text-xs text-slate-400">Key: <b className="text-emerald-300">{L[q.answer]}</b> · {q.options[q.answer]}</div>
            {answering && (
              <p className="mt-3 rounded-lg bg-indigo-500/10 p-2 text-xs text-indigo-100 ring-1 ring-indigo-400/30">
                🎙 Waiting for group answers. Tap them below, or say “everyone B” or “group A, C”. Then say “is that correct?” or “continue”.
              </p>
            )}
            {answering ? (
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
                          const sel = ss.responses[g] === i;
                          return (
                            <td key={i} className="text-center">
                              <button
                                className={`h-8 w-8 rounded-md text-xs font-bold transition ${sel ? "bg-indigo-500 text-white ring-2 ring-indigo-300" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                                onClick={() => engine.setChallengeResponse(g, sel ? null : i)}
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
            ) : (
              <p className="mt-3 text-sm text-slate-200">
                {Math.round(ss.lastRate * 100)}% of groups were right. {ss.lastRate >= PASS_RATE ? "Most groups got it." : step.support && !easier ? "Next comes an easier try." : "It may be worth talking this through."}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {answering ? (
                <>
                  <button className="btn btn-ghost" onClick={() => engine.simulateChallengeResponses()}>🎲 Fill demo group answers</button>
                  <button className="btn btn-success ml-auto" disabled={entered === 0} onClick={() => engine.revealChallenge()}>Reveal answer</button>
                </>
              ) : (
                <button className="btn btn-primary ml-auto" onClick={() => engine.advanceChallenge()}>Continue →</button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
