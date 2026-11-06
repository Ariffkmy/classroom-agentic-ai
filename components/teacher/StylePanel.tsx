"use client";
import { useEffect, useState } from "react";
import type { ClassroomState, ReelLanguageId } from "@/lib/types";
import type { ClassroomEngine } from "@/lib/engine";
import { REEL_LANGUAGES, REEL_LENGTHS, REEL_STYLES, reelLanguage } from "@/lib/reel/styles";
import { Toggle } from "./ui";

const SELECT = "mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm";

/** Teachers shape how videos look and sound. The words always come from the lesson itself. */
export default function StylePanel({ state, engine }: { state: ClassroomState; engine: ClassroomEngine }) {
  const r = state.settings.reel;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const prefix = reelLanguage(r.language).speech;
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  const shown = matching.length ? matching : voices;

  return (
    <section className="card" aria-label="Video style">
      <div className="card-h"><span>🎨 Video style</span></div>
      <div className="space-y-3 px-4 py-3">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Visual style">
          {REEL_STYLES.map((st) => (
            <button
              key={st.id}
              role="radio"
              aria-checked={r.style === st.id}
              onClick={() => engine.updateReel({ style: st.id })}
              className={`rounded-lg border px-2.5 py-2 text-left text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${r.style === st.id ? "border-indigo-400 bg-indigo-500/20 text-white" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"}`}
            >
              <span className="block font-semibold">{st.emoji} {st.name}</span>
              <span className="mt-0.5 block text-[11px] text-slate-400">{st.blurb}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-200" htmlFor="reel-language">Language</label>
            <select id="reel-language" className={SELECT} value={r.language} onChange={(e) => engine.updateReel({ language: e.target.value as ReelLanguageId, voice: "" })}>
              {REEL_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-200" htmlFor="reel-length">Length</label>
            <select id="reel-length" className={SELECT} value={r.lengthSec} onChange={(e) => engine.updateReel({ lengthSec: Number(e.target.value) })}>
              {REEL_LENGTHS.map((n) => <option key={n} value={n}>About {n} seconds</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-200" htmlFor="reel-voice">Narrator voice</label>
          <select id="reel-voice" className={SELECT} value={r.voice} onChange={(e) => engine.updateReel({ voice: e.target.value })}>
            <option value="">Automatic</option>
            {shown.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
          {voices.length > 0 && !matching.length && (
            <span className="mt-1 block text-xs text-amber-300">
              This browser has no {reelLanguage(r.language).label} voice, so narration will sound off. Install one in Windows speech settings, or turn narration off.
            </span>
          )}
        </div>
        <Toggle label="On-screen captions" checked={r.captions} onChange={(v) => engine.updateReel({ captions: v })} />
        <p className="text-xs text-slate-400">The script is written automatically from what the AI hears in the lesson. Style and captions apply straight away; language and length apply to the next video.</p>
      </div>
    </section>
  );
}
