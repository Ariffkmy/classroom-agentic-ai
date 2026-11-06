// Server-side route to Claude. Uses ANTHROPIC_API_KEY when set; otherwise falls back to the
// local Claude Code CLI on the teacher's own subscription, as Reel Studio does.

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const KEY = process.env.ANTHROPIC_API_KEY;
const API_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const CLI = process.env.CLAUDE_CODE_CMD || "claude";
const CLI_MODEL = process.env.CLAUDE_CODE_MODEL || "sonnet";
const CLI_DISABLED = process.env.CLAUDE_CODE_DISABLED === "1";
const IS_WIN = process.platform === "win32";

export type Engine = "api" | "claude-code";

/** The CLI spends the teacher's own subscription, so only the local machine may trigger it. */
function isLocalRequest(req: Request) {
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function exec(args: string, input: string, timeoutMs: number, opts: { onOut?: (chunk: string) => void; signal?: AbortSignal } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    // npm installs the CLI as a .cmd shim on Windows, which needs a shell. Args here are fixed
    // strings; lesson text only ever travels through stdin.
    const child = spawn(`${CLI} ${args}`, { shell: true, cwd: tmpdir(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const kill = () => {
      if (IS_WIN && child.pid) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
      else child.kill("SIGKILL");
    };
    const timer = setTimeout(() => {
      kill();
      reject(new Error(`Claude Code timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
    opts.signal?.addEventListener("abort", kill, { once: true });
    child.stdout.setEncoding("utf8"); // keeps multi-byte characters such as ² whole across chunks
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d: string) => {
      out += d;
      opts.onOut?.(d);
    });
    child.stderr.on("data", (d: string) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`Claude Code exited ${code}: ${err.slice(0, 300)}`));
    });
    child.stdin.on("error", () => {}); // a CLI that exits early closes stdin; `close` reports it
    child.stdin.end(input);
  });
}

let cliCheck: Promise<boolean> | null = null;
function cliAvailable() {
  if (CLI_DISABLED) return Promise.resolve(false);
  cliCheck ??= exec("--version", "", 15000).then(() => true, () => false);
  return cliCheck;
}

export async function activeEngine(req: Request): Promise<{ engine: Engine; model: string } | null> {
  if (KEY) return { engine: "api", model: API_MODEL };
  if (isLocalRequest(req) && (await cliAvailable())) return { engine: "claude-code", model: `Claude Code (${CLI_MODEL})` };
  return null;
}

let systemFile: { text: string; path: string } | null = null;
function systemPromptFile(text: string) {
  if (systemFile?.text !== text) {
    const path = join(mkdtempSync(join(tmpdir(), "classroom-claude-")), "system.txt");
    writeFileSync(path, text, "utf8");
    systemFile = { text, path };
  }
  return systemFile.path;
}

async function viaApi(system: string, prompt: string, maxTokens: number, timeoutMs: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: API_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  const data = await res.json();
  return (data.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
}

async function viaCli(system: string, prompt: string, timeoutMs: number): Promise<string> {
  // Isolated on purpose. No tools: the prompt holds classroom speech, which must never be able
  // to drive an agent. No user settings or MCP servers: they add 200k+ tokens to every call.
  const args = [
    "-p", "--output-format", "json", ...CLI_ISOLATION,
    "--system-prompt-file", `"${systemPromptFile(system)}"`, "--model", CLI_MODEL,
  ].join(" ");
  const parsed = JSON.parse(await exec(args, prompt, timeoutMs));
  if (parsed.is_error) throw new Error(`Claude Code error: ${String(parsed.result).slice(0, 200)}`);
  return String(parsed.result ?? "");
}

const CLI_ISOLATION = ['--tools ""', "--no-session-persistence", '--setting-sources ""', "--strict-mcp-config"];

async function streamApi(system: string, prompt: string, maxTokens: number, timeoutMs: number, onText: (t: string) => void, signal?: AbortSignal) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: API_MODEL, max_tokens: maxTokens, stream: true, system, messages: [{ role: "user", content: prompt }] }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok || !res.body) throw new Error(`Upstream ${res.status}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += value;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5));
        if (ev.delta?.type === "text_delta") onText(ev.delta.text);
      } catch {
        /* keep-alive or partial event */
      }
    }
  }
}

async function streamCli(system: string, prompt: string, timeoutMs: number, onText: (t: string) => void, signal?: AbortSignal) {
  const args = [
    "-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages", ...CLI_ISOLATION,
    "--system-prompt-file", `"${systemPromptFile(system)}"`, "--model", CLI_MODEL,
  ].join(" ");
  let buf = "";
  await exec(args, prompt, timeoutMs, {
    signal,
    onOut: (chunk) => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        try {
          const ev = JSON.parse(line);
          if (ev.type === "stream_event" && ev.event?.delta?.type === "text_delta") onText(ev.event.delta.text);
        } catch {
          /* not an event line */
        }
      }
    },
  });
}

/** Sends text to `onText` as it is generated, so speech can start before the reply is finished. */
export function completeStream(engine: Engine, system: string, prompt: string, opts: { maxTokens: number; timeoutMs: number; signal?: AbortSignal }, onText: (t: string) => void) {
  return engine === "api"
    ? streamApi(system, prompt, opts.maxTokens, opts.timeoutMs, onText, opts.signal)
    : streamCli(system, prompt, opts.timeoutMs, onText, opts.signal);
}

export function complete(engine: Engine, system: string, prompt: string, opts: { maxTokens: number; timeoutMs: number }) {
  return engine === "api" ? viaApi(system, prompt, opts.maxTokens, opts.timeoutMs) : viaCli(system, prompt, opts.timeoutMs);
}
