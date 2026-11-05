"use client";
import type { ClassroomState } from "@/lib/types";
import type { ClassroomEngine } from "@/lib/engine";
import { Toggle } from "./ui";

export default function SettingsPanel({ state, engine }: { state: ClassroomState; engine: ClassroomEngine }) {
  const s = state.settings;
  return (
    <section className="card" aria-label="Teacher controls">
      <div className="card-h"><span>🎛 Teacher controls & autonomy</span></div>
      <div className="divide-y divide-slate-800 px-4 py-1">
        <Toggle label="Autonomous generation" desc="AI decides when to create content" checked={s.autoGenerate} onChange={(v) => engine.updateSettings({ autoGenerate: v })} />
        <Toggle label="Automatic presentation" desc="Show checked content at a natural pause" checked={s.autoPresent} onChange={(v) => engine.updateSettings({ autoPresent: v })} />
        <Toggle label="AI voice responses" checked={s.voiceOutput} onChange={(v) => engine.updateSettings({ voiceOutput: v })} />
        <Toggle label="Narrate presentations" checked={s.narration} onChange={(v) => engine.updateSettings({ narration: v })} />
        <div className="py-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="fault">Failure drill (for judges)</label>
          <span className="block text-xs text-slate-400">Arms a one-off fault for the next content task</span>
          <select
            id="fault"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            value={s.failureMode}
            onChange={(e) => engine.updateSettings({ failureMode: e.target.value as typeof s.failureMode })}
          >
            <option value="none">None</option>
            <option value="generation">Video provider fails (AT-12)</option>
            <option value="validation">Content fails a check (AT-07)</option>
          </select>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-slate-400">Clear all lesson data on this device</span>
          <button className="btn btn-ghost !py-1 !text-xs" onClick={() => engine.reset()}>Reset session</button>
        </div>
      </div>
    </section>
  );
}
