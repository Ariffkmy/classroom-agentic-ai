"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getEngine, SERVER_STATE } from "@/lib/engine";
import type { ClassroomState } from "@/lib/types";

/** Teacher tab: owns the orchestrator engine. */
export function useClassroom() {
  const engine = getEngine();
  useEffect(() => {
    engine.start();
    (window as unknown as { __classroom: unknown }).__classroom = engine; // handy for scripted demos/debugging
  }, [engine]);
  const state = useSyncExternalStore(engine.subscribe, engine.getState, () => SERVER_STATE);
  return { state, engine };
}

/** Classroom display tab: mirrors state from the teacher tab via BroadcastChannel. */
export function useMirroredClassroom() {
  const [state, setState] = useState<ClassroomState | null>(null);
  const [channel, setChannel] = useState<BroadcastChannel | null>(null);
  useEffect(() => {
    const ch = new BroadcastChannel("asc-display");
    ch.onmessage = (e) => {
      if (e.data?.type === "state") setState(e.data.state);
    };
    ch.postMessage({ type: "hello" });
    const t = setInterval(() => ch.postMessage({ type: "hello" }), 4000);
    setChannel(ch);
    return () => {
      clearInterval(t);
      ch.close();
    };
  }, []);
  const send = (cmd: string) => channel?.postMessage({ type: "cmd", cmd });
  return { state, send };
}
