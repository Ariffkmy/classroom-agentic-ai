// Thin client for the server-side AI gateway.
import type { SyllabusMatch, SyllabusQuery } from "./syllabus/match";

export async function llmStatus(): Promise<{ enabled: boolean; model?: string; engine?: "api" | "claude-code" }> {
  try {
    const r = await fetch("/api/ai", { cache: "no-store" });
    return await r.json();
  } catch {
    return { enabled: false };
  }
}

/** Streams a text reply. Resolves with the full text, or "" if nothing arrived. */
export async function llmStream(task: string, payload: Record<string, unknown>, onText: (chunk: string) => void, signal: AbortSignal): Promise<string> {
  let full = "";
  try {
    const r = await fetch("/api/ai", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, stream: true, ...payload }), signal,
    });
    if (!r.ok || !r.body) return "";
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      full += value;
      onText(value);
    }
  } catch {
    /* aborted or offline: the caller works from whatever text it already has */
  }
  return full;
}

/** Needs no model, so standards can still be found offline. */
export async function lookupSyllabus(query: SyllabusQuery): Promise<SyllabusMatch[]> {
  try {
    const r = await fetch("/api/syllabus", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(query) });
    return r.ok ? ((await r.json()).matches as SyllabusMatch[]) : [];
  } catch {
    return [];
  }
}

export async function llmCall<T = unknown>(task: string, payload: Record<string, unknown>): Promise<T | null> {
  try {
    const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, ...payload }) });
    if (!r.ok) return null;
    const d = await r.json();
    return (d.json ?? d.text ?? null) as T | null;
  } catch {
    return null;
  }
}
