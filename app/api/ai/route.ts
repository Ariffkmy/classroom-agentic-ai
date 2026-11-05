// Server-side AI gateway. API keys never reach the browser (NFR-05).
// If ANTHROPIC_API_KEY is not configured the client falls back to the
// deterministic on-device agents, so the demo always works offline.

import { NextResponse } from "next/server";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const KEY = process.env.ANTHROPIC_API_KEY;

export async function GET() {
  return NextResponse.json({ enabled: Boolean(KEY), model: KEY ? MODEL : undefined });
}

const SYSTEM = `You are an agent inside an "Agentic AI Smart Classroom" teaching assistant used in Malaysian schools.
Rules: classroom-appropriate, concise, accurate. Never invent official curriculum codes — if unsure, use codes like "AI-1" and the system will label them unverified.
Never refer to or identify individual students. Use fictional characters in stories.`;

const PROMPTS: Record<string, (b: Body) => string> = {
  answer: (b) =>
    `Lesson context: ${JSON.stringify(b.context)}\nThe teacher asked you (spoken, in class): "${b.text}"\nReply in at most 3 short spoken sentences suitable for the students' level. Plain text only.`,
  classify: (b) =>
    `Here is a rolling transcript of a teacher speaking in class:\n"""${b.text}"""\nInfer the lesson. Return ONLY JSON: {"subject":string,"topic":string,"level":string,"confidence":number(0-1),"concepts":string[],"objectives":[{"code":string,"text":string}],"summary":string}. If it is not clearly a lesson, set confidence below 0.4.`,
  storyboard: (b) =>
    `Lesson context: ${JSON.stringify(b.context)}\nCreate a short animated storyboard (4 scenes) that makes this lesson engaging with a real-world example. Return ONLY JSON: {"title":string,"scenes":[{"title":string,"caption":string,"narration":string,"formula":string|null,"emoji":string[] (1-4 emoji)}]}. The final scene must be a question for groups to discuss.`,
  quiz: (b) =>
    `Lesson context: ${JSON.stringify(b.context)}\nWrite ${b.n ?? 5} multiple-choice questions. Return ONLY JSON: {"questions":[{"prompt":string,"options":[4 strings],"answer":number(index),"concept":string(short kebab-case),"explanation":string}]}.`,
};

interface Body {
  task: keyof typeof PROMPTS;
  text?: string;
  context?: unknown;
  n?: number;
}

export async function POST(req: Request) {
  if (!KEY) return NextResponse.json({ error: "LLM not configured" }, { status: 503 });
  const body = (await req.json()) as Body;
  const build = PROMPTS[body.task];
  if (!build) return NextResponse.json({ error: "Unknown task" }, { status: 400 });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: body.task === "answer" ? 300 : 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: build(body) }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 });
    const data = await res.json();
    const text: string = (data.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    if (body.task === "answer") return NextResponse.json({ text: text.trim() });
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "No JSON in response" }, { status: 502 });
    return NextResponse.json({ json: JSON.parse(m[0]) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
