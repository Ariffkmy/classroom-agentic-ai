// Small spoken phrases that make the assistant sound like a person in the room. They stay light
// and classroom-friendly. Replies from the model get the same tone through their prompt.

import type { ReelLanguageId } from "../types";

export type PhraseKind = "thinking" | "idea" | "gotIt" | "right" | "wrong" | "quizStart";

const ENGLISH: Record<PhraseKind, string[]> = {
  thinking: ["Hmm, let me check it for you.", "Hmm, let me think about that for a second.", "Okay, give me a moment.", "Ooh, good one. Let me see."],
  idea: ["Ahh, now I know what might help.", "Aha, I have an idea.", "Hmm, I think I know what will help here."],
  gotIt: ["Okay, noted.", "Got it.", "Alright."],
  right: ["Yes, that's it!", "Ahh, that's right!", "Nice, that's correct."],
  wrong: ["Hmm, not quite.", "Ooh, close, but not quite.", "Hmm, let's look at that again."],
  quizStart: ["Okay, let's see what we've understood so far. Groups, use your answer cards.", "Alright, quick check! Groups, use your answer cards."],
};

const MALAY: Record<PhraseKind, string[]> = {
  thinking: ["Hmm, sekejap ya, saya semak dulu.", "Okay, biar saya fikir sekejap.", "Hmm, soalan yang bagus. Sekejap ya."],
  idea: ["Ahh, baru saya tahu apa yang boleh membantu.", "Aha, saya ada idea.", "Hmm, saya rasa ini boleh membantu."],
  gotIt: ["Okay, saya catat.", "Baik.", "Okay, baik."],
  right: ["Ya, betul tu!", "Ahh, betul!", "Bagus, itu jawapan yang betul."],
  wrong: ["Hmm, belum tepat lagi.", "Ooh, hampir betul.", "Hmm, jom kita tengok semula."],
  quizStart: ["Okay, jom kita tengok apa yang kita faham setakat ini. Kumpulan, sedia kad jawapan.", "Baik, semakan ringkas! Kumpulan, sedia kad jawapan."],
};

const CASUAL: Partial<Record<PhraseKind, string[]>> = {
  thinking: ["Hmm, jap ya, saya check dulu.", "Okay, bagi saya fikir kejap.", "Hmm, soalan best tu. Kejap ya."],
  right: ["Haa, betul tu!", "Ya, dapat dah!", "Bagus, betul tu."],
  wrong: ["Hmm, belum tepat lagi.", "Alamak, hampir betul.", "Hmm, jom tengok balik."],
};

const MIXED: Partial<Record<PhraseKind, string[]>> = {
  thinking: ["Hmm, kejap ya, let me check.", "Okay, give me a moment ya.", "Hmm, good question. Kejap ya."],
  idea: ["Ahh, now I know apa yang boleh bantu.", "Aha, saya ada idea."],
  right: ["Haa, that's right!", "Yes, betul tu!"],
};

function list(kind: PhraseKind, language: ReelLanguageId) {
  if (language === "ms-formal") return MALAY[kind];
  if (language === "ms-casual") return CASUAL[kind] ?? MALAY[kind];
  if (language === "mixed") return MIXED[kind] ?? ENGLISH[kind];
  return ENGLISH[kind];
}

/** Picks a phrase, never the same one twice in a row. */
export function pickPhrase(kind: PhraseKind, language: ReelLanguageId, last?: string, random = Math.random) {
  const all = list(kind, language);
  const options = all.filter((p) => p !== last);
  return options[Math.floor(random() * options.length)] ?? all[0];
}
