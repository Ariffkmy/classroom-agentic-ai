// Finds the DSKP standards that match what the teacher is saying. It is plain text matching, so it
// also works offline. Words that appear in few standards count for more than common ones.

export interface SyllabusStandard { c: string; t: string; p?: number | null }
export interface SyllabusContent extends SyllabusStandard { sp: SyllabusStandard[] }

export interface SyllabusDoc {
  subject: string;
  year: number;
  document: string;
  url: string;
  status: string; // the extraction check, not an approval by KPM
  sk: SyllabusContent[];
}

export interface SyllabusQuery {
  text: string;
  terms?: string[];
  subject?: string;
  year?: number | null;
}

export interface SyllabusMatch {
  subject: string;
  year: number;
  document: string;
  url: string;
  status: string;
  page?: number | null;
  unit: { code: string; title: string };
  objectives: { code: string; text: string }[];
  next: string[];
  score: number;
  titleHit: boolean; // a lesson word appears in the standard's own title
}

const STOP = new Set(("this that with have what will look here there they them then from your about into when were been also just okay good morning today class students teacher please "
  + "yang dengan untuk pada kepada dalam daripada kita kami saya awak ialah adalah akan juga atau tetapi kalau jadi sila mari lihat sekarang hari kelas murid cikgu selamat pagi tahun year boleh semua "
  + "berikan tentang belajar").split(" "));

const SUBJECTS: [RegExp, string[]][] = [
  [/math|matemat/i, ["Matematik", "Mathematics (DLP)"]],
  [/scien|sains/i, ["Sains", "Science (DLP)"]],
  [/english|inggeris/i, ["Bahasa Inggeris", "Bahasa Inggeris (CEFR)"]],
  [/melayu|malay/i, ["Bahasa Melayu"]],
];

const MIN_WORDS = 2;

function tokens(text: string) {
  return [...new Set((text.toLowerCase().match(/\p{L}{4,}/gu) ?? []).filter((w) => !STOP.has(w)))];
}

export function yearFrom(text: string): number | null {
  const m = text.match(/\b(?:tahun|year)\s*([1-6])\b/i);
  return m ? Number(m[1]) : null;
}

function subjectFilter(subject?: string) {
  if (!subject) return () => true;
  const names = SUBJECTS.find(([re]) => re.test(subject))?.[1];
  return (d: SyllabusDoc) => (names ? names.includes(d.subject) : d.subject.toLowerCase().includes(subject.toLowerCase()));
}

/**
 * Returns the closest content standards, best first. Word matching alone can be confidently wrong
 * ("matahari" finds eclipses for a lesson on plants), so these are candidates, not an answer.
 */
export function findCandidates(docs: SyllabusDoc[], q: SyllabusQuery, limit = 5): SyllabusMatch[] {
  const year = q.year ?? yearFrom(q.text);
  const pool = docs.filter(subjectFilter(q.subject)).filter((d) => !year || d.year === year);
  const words = tokens(`${q.text} ${(q.terms ?? []).join(" ")}`);
  if (!pool.length || !words.length) return [];

  const units = pool.flatMap((doc) => doc.sk.map((sk, i) => ({
    doc, sk, i, title: sk.t.toLowerCase(), body: sk.sp.map((p) => p.t).join(" ").toLowerCase(),
  })));
  const seen = (w: string) => units.filter((u) => u.title.includes(w) || u.body.includes(w)).length;
  const weight = new Map(words.map((w) => [w, Math.log(1 + units.length / (1 + seen(w)))]));

  const scored = units.map((unit) => {
    let score = 0;
    let hits = 0;
    let titleHit = false;
    for (const w of words) {
      const inTitle = unit.title.includes(w);
      if (!inTitle && !unit.body.includes(w)) continue;
      hits += 1;
      titleHit ||= inTitle;
      score += (weight.get(w) ?? 0) * (inTitle ? 3 : 1);
    }
    return { unit, hits, titleHit, score: unit.doc.status === "verified" ? score * 1.05 : score };
  }).filter((x) => x.hits >= MIN_WORDS).sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ unit: { doc, sk, i }, score, titleHit }) => ({
    subject: doc.subject, year: doc.year, document: doc.document, url: doc.url, status: doc.status, page: sk.p,
    unit: { code: sk.c, title: sk.t },
    objectives: sk.sp.slice(0, 5).map((p) => ({ code: p.c, text: p.t })),
    next: doc.sk.slice(i + 1, i + 3).map((x) => `${x.c} ${x.t}`),
    score: Math.round(score * 10) / 10, titleHit,
  }));
}
