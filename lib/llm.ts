// Thin client for the server-side AI gateway.
export async function llmStatus(): Promise<{ enabled: boolean; model?: string }> {
  try {
    const r = await fetch("/api/ai", { cache: "no-store" });
    return await r.json();
  } catch {
    return { enabled: false };
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
