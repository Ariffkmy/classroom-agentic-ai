"use client";
import { useEffect, useState } from "react";
import { useClassroom } from "@/hooks/useClassroom";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import Header from "@/components/teacher/Header";
import TranscriptPanel from "@/components/teacher/TranscriptPanel";
import ContextPanel from "@/components/teacher/ContextPanel";
import PipelinePanel from "@/components/teacher/PipelinePanel";
import PresentationPanel from "@/components/teacher/PresentationPanel";
import AgentLog from "@/components/teacher/AgentLog";
import SettingsPanel from "@/components/teacher/SettingsPanel";
import StylePanel from "@/components/teacher/StylePanel";
import QuizPanel from "@/components/teacher/QuizPanel";
import LessonSummary from "@/components/teacher/LessonSummary";

export default function TeacherPage() {
  const { state, engine } = useClassroom();
  const [micWanted, setMicWanted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  useSpeechRecognition(engine, micWanted && state.lesson.status === "live");

  useEffect(() => {
    if (state.lesson.status === "ended") setShowSummary(true);
  }, [state.lesson.status]);
  useEffect(() => {
    if (state.listening === "denied" || state.listening === "unsupported") setMicWanted(false);
  }, [state.listening]);

  // Keyboard shortcuts for core actions (NFR-09)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "SELECT") return;
      if (e.key === "Escape") {
        const m = engine.getState().presentation.mode;
        if (m === "quiz" || m === "results") engine.closeQuiz();
        else engine.dismiss();
      }
      if (e.key === " " && engine.getState().presentation.mode === "content") {
        e.preventDefault();
        if (engine.getState().presentation.playing) engine.pausePresentation();
        else engine.resumePresentation();
      }
      if (e.key.toLowerCase() === "m" && engine.getState().lesson.status === "live") setMicWanted((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine]);

  return (
    <div className="min-h-screen bg-slate-950">
      <Header state={state} engine={engine} micWanted={micWanted} setMicWanted={setMicWanted} />
      <main className="mx-auto grid max-w-[1800px] gap-4 p-4 xl:grid-cols-[minmax(320px,1fr)_minmax(0,1.5fr)_minmax(340px,1.1fr)]">
        <div className="flex flex-col gap-4 xl:h-[calc(100vh-90px)] xl:sticky xl:top-[70px]">
          <div className="flex min-h-[420px] flex-1 flex-col xl:min-h-0"><TranscriptPanel state={state} engine={engine} /></div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <PresentationPanel state={state} engine={engine} />
          {state.quizSession && <QuizPanel state={state} engine={engine} />}
          <ContextPanel state={state} engine={engine} />
          <div className="flex max-h-[720px] min-h-[260px] flex-col"><PipelinePanel state={state} engine={engine} /></div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex h-[360px] flex-col"><AgentLog state={state} /></div>
          <StylePanel state={state} engine={engine} />
          <SettingsPanel state={state} engine={engine} />
        </div>
      </main>
      <footer className="pb-4 text-center text-[11px] text-slate-600">Shortcuts: <kbd>Esc</kbd> dismiss · <kbd>Space</kbd> pause/resume · <kbd>M</kbd> toggle mic</footer>
      {showSummary && state.lesson.status === "ended" && <LessonSummary state={state} engine={engine} onClose={() => setShowSummary(false)} />}
    </div>
  );
}
