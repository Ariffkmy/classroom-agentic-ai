// Looks up DSKP standards on the server, so the whole data set never goes to the browser or a model.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { findCandidates, type SyllabusDoc, type SyllabusQuery } from "@/lib/syllabus/match";

let loaded: Promise<SyllabusDoc[]> | null = null;
const load = () => (loaded ??= readFile(join(process.cwd(), "data", "syllabus.json"), "utf8").then((t) => JSON.parse(t) as SyllabusDoc[]));

export async function POST(req: Request) {
  const q = (await req.json()) as Partial<SyllabusQuery>;
  if (typeof q.text !== "string") return NextResponse.json({ error: "text is required" }, { status: 400 });
  try {
    const matches = findCandidates(await load(), {
      text: q.text.slice(0, 6000), subject: typeof q.subject === "string" ? q.subject : undefined,
      year: typeof q.year === "number" ? q.year : null, terms: Array.isArray(q.terms) ? q.terms.filter((t) => typeof t === "string").slice(0, 20) : undefined,
    });
    return NextResponse.json({ matches });
  } catch (e) {
    console.error("[syllabus] lookup failed:", e);
    return NextResponse.json({ matches: [] });
  }
}
