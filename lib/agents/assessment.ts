// Assessment Agent: class/group-level analysis only. No individual judgements (§14).

import type { Insights, Quiz, QuizSession } from "../types";
import { getTopic } from "../curriculum";

export const FLAG_THRESHOLD = 0.6;

export function analyse(quiz: Quiz, session: QuizSession): Insights {
  const topic = getTopic(quiz.topicId);
  const stats = quiz.questions.map((q) => {
    const answers = Object.values(session.responses[q.id] ?? {}).filter((v): v is number => v !== null && v !== undefined);
    const distribution = q.options.map((_, i) => answers.filter((a) => a === i).length);
    const correct = distribution[q.answer] ?? 0;
    const rate = answers.length ? correct / answers.length : 0;
    let commonWrong: string | undefined;
    const wrong = distribution.map((n, i) => ({ n, i })).filter((d) => d.i !== q.answer).sort((a, b) => b.n - a.n)[0];
    if (wrong && wrong.n > 0) commonWrong = q.options[wrong.i];
    return {
      questionId: q.id, prompt: q.prompt, concept: q.concept, responses: answers.length,
      correct, rate, distribution, flagged: answers.length > 0 && rate < FLAG_THRESHOLD, commonWrong,
    };
  });

  const answered = stats.filter((s) => s.responses > 0);
  const totalResp = answered.reduce((a, s) => a + s.responses, 0);
  const overallRate = totalResp ? answered.reduce((a, s) => a + s.correct, 0) / totalResp : 0;
  const sampleSize = Math.max(0, ...stats.map((s) => s.responses));

  // Rank weak concepts by lowest correct rate.
  const conceptRates = new Map<string, { c: number; n: number }>();
  for (const s of answered) {
    const r = conceptRates.get(s.concept) ?? { c: 0, n: 0 };
    r.c += s.correct; r.n += s.responses;
    conceptRates.set(s.concept, r);
  }
  const weakConcepts = [...conceptRates.entries()]
    .map(([k, v]) => ({ k, rate: v.c / v.n }))
    .filter((x) => x.rate < FLAG_THRESHOLD)
    .sort((a, b) => a.rate - b.rate)
    .map((x) => x.k);

  const top = weakConcepts.find((c) => topic?.followUps[c]) ?? weakConcepts[0];
  const follow = top ? topic?.followUps[top] : undefined;
  const worst = stats.filter((s) => s.flagged).sort((a, b) => a.rate - b.rate)[0];

  let recommendation: string;
  if (!answered.length) recommendation = "No responses recorded yet.";
  else if (!weakConcepts.length) recommendation = "All questions were answered correctly by most groups. Suggest moving on, or an extension problem for early finishers.";
  else if (follow) recommendation = follow.explanation;
  else recommendation = `Groups found "${worst?.prompt}" difficult. Suggest revisiting this concept with another worked example before moving on.`;

  const caveat =
    sampleSize < 4
      ? `Only ${sampleSize} group response(s) — too few to generalise. Treat as an indication only.`
      : `Based on ${sampleSize} group responses. Results describe the class as groups and say nothing about any individual student.`;

  return {
    quizId: quiz.id, sampleSize, overallRate, stats, weakConcepts, recommendation, caveat,
    followUp: follow && top ? { title: follow.title, conceptKey: top } : undefined,
    generatedAt: Date.now(),
  };
}
