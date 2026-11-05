"use client";
// Realtime voice layer (browser speech-to-text). Only *final* transcript segments are
// forwarded to the orchestrator; interim text is shown as live captions.
import { useCallback, useEffect, useRef } from "react";
import type { ClassroomEngine } from "@/lib/engine";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function useSpeechRecognition(engine: ClassroomEngine, wanted: boolean) {
  const recRef = useRef<any>(null);
  const wantedRef = useRef(wanted);
  wantedRef.current = wanted;

  const supported = typeof window !== "undefined" && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const start = useCallback(async () => {
    if (!supported) {
      engine.setListening("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      engine.setListening("denied");
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-MY";
    rec.onresult = (e: any) => {
      if (engine.isEchoWindow) return; // ignore the AI's own voice
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) engine.ingest(r[0].transcript, "mic");
        else interim += r[0].transcript;
      }
      engine.setInterim(interim);
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") engine.setListening("denied");
    };
    rec.onend = () => {
      // Browsers stop recognition periodically; keep listening while the teacher wants it.
      if (wantedRef.current && recRef.current === rec) {
        try {
          rec.start();
        } catch {}
      }
    };
    recRef.current = rec;
    try {
      rec.start();
      engine.setListening("listening");
    } catch {
      engine.setListening("unsupported");
    }
  }, [engine, supported]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.stop();
    } catch {}
    engine.setInterim("");
  }, [engine]);

  useEffect(() => {
    if (wanted) void start();
    else stop();
    return stop;
  }, [wanted, start, stop]);

  return { supported };
}
