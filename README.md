# 🎓 Agentic AI Smart Classroom

A voice-enabled AI teaching assistant that **listens to the lesson, works out the subject and topic on its own, maps it to the curriculum, autonomously generates and validates an animation, presents it at a natural pause, runs a group quiz and recommends what to re-teach**, while the teacher stays in control.

Competition prototype built from SRS v1.1. It's made to give a reliable live demo for judges.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

| Page | Purpose |
|------|---------|
| `/` | Landing page and a 3-minute demo guide for judges |
| `/teacher` | Teacher dashboard: mic, transcript, AI understanding, content studio, agent trace, quiz |
| `/display` | Classroom display for the projector. Open it in a second window of the **same browser**; it stays in sync |
| `/architecture` | Agent architecture and how to demonstrate each acceptance test |

Use **Chrome or Edge** for live speech recognition. Other browsers can use the text input or the demo voice.

### How the AI runs
The app uses the first of these that works. All access is server-side (`lib/server/claude.ts`).

1. **`ANTHROPIC_API_KEY`** in `.env.local` (copy `.env.example`).
2. **Claude Code**: the local `claude` CLI on your own subscription, the way Reel Studio works. Run `claude` once in a terminal to log in. It's only used for requests from this machine, with tools disabled.
3. **On-device agents**: nothing to set up and no network needed, so the demo always works.

## Generating videos
Video generation brings in the logic from Reel Studio, rebuilt so it can run during a live lesson.

1. **Listen:** the last 14 segments the teacher said, plus the detected topic, concepts and objectives, become the input. Requests made to the AI ("Hey assistant…") are left out.
2. **Plan:** Claude writes Reel Studio's plan: a hook, one row per spoken sentence, and a closing group question (`lib/reel/prompt.ts`). Each row picks a visual block, such as a formula, triangle, flow or chart. Offline, `lib/reel/composer.ts` builds the plan from the teacher's own sentences.
3. **Check:** the plan is sanitised (`lib/reel/plan.ts`), then has to pass the six automated checks.
4. **Play:** a port of Reel Studio's scene toolkit (`lib/reel/kit.ts`) draws the scenes with GSAP on a 16:9 stage, timed to the narration.

**Teachers control the style, not the script.** The *Video style* panel sets the look (5 themes), language, length, narrator voice and captions. The script can be read in the content studio but not edited. *Make a different version* rewrites it automatically.

**Differences from Reel Studio**

| | Reel Studio | This app |
|---|---|---|
| Time per video | 10–30+ minutes | About 20 seconds |
| Script approval | A person approves the plan | Automatic, then the six checks |
| Scene source | Claude writes JavaScript | Claude picks from fixed data blocks, so generated text never runs as code |
| Output | 9:16 MP4 | Live 16:9 playback in the browser |
| Voice timing | Whisper word timings | Estimated, because browser speech has no timestamps |

Not brought across: MP4 export, the 7 canvas styles, talking-video mode, sound effects and music.

Quizzes, *everyday example* and *simpler* answers still use the pre-written dataset for the three built-in topics. Topic detection without a language model also only knows those three.

## Talking to the AI
Start with "Hey assistant…". After each reply, a green prompt shows the AI is listening for 10 seconds, and the teacher can answer without the wake phrase:

* **Follow-ups** such as "why is that?" or "give me another one" get an answer that takes the last few turns into account.
* **"Thanks"** ends the conversation. Going back to teaching ends it too.
* **Interrupting:** saying "Hey assistant…" cuts the AI off mid-sentence. Other speech is ignored while it talks, so it doesn't react to its own voice.

Replies stream, so the AI starts speaking after its first sentence. With no wake phrase, the AI judges a follow-up from its wording and length (a question, or a short question-like phrase), so it can occasionally mistake a teaching line for a follow-up during that 10-second window.

## 3-minute demo script

1. Open `/teacher` and click **📺 Open classroom display**. Move that window to the projector.
2. Click **▶ Start lesson**. No subject or topic is entered (AT-01).
3. Teach into the mic, or press **▶ Run** next to *Demo voice* to play the scripted Pythagoras lesson.
4. Watch the **AI's understanding** panel. It detects *Mathematics → Pythagoras' Theorem*, picks out concepts and maps them to KSSM Form 2 learning standards (AT-02/03).
5. After the teacher explains *a² + b² = c²*, the orchestrator decides on its own to make a video and writes the script from what it just heard. This happens in the background while the lesson continues (AT-04).
6. Six automated checks run (AT-05). Once they pass, the video plays with narration **at the next pause in the teacher's speech** (AT-06).
7. *"Hey assistant, give another everyday example."* The AI answers out loud and shows a card.
8. *"Hey assistant, prepare five questions."* The quiz goes on the display. Groups hold up answer cards and the teacher taps them in (or uses **🎲 Fill demo group answers**). Then click **📊 Analyse responses** (AT-09/10).
9. The Assessment agent flags Q3 (identifying the hypotenuse) and creates a **follow-up animation** on its own (AT-11).
10. **Failure drills:** under *Teacher controls → Failure drill*, pick *Script service fails* (AT-12) or *Content fails a check* (AT-07). The lesson keeps going and a safe fallback diagram is shown.
11. **Teacher override:** Dismiss/`Esc` (AT-08), Pause listening/`M` (AT-13), autonomy toggles, revise, cancel.
12. **■ End lesson** opens a privacy-minimised lesson summary with JSON export.

There is also a *Science: Photosynthesis* demo voice, which shows **automatic topic-change detection**.

## Architecture

```
Mic ─► Realtime voice layer (browser STT, interim captions)
          │  final transcript segments / commands only
          ▼
   AI Orchestrator (lib/engine.ts) ── lesson state, decisions, task tracking, retries
    ├─ Listening agent      lib/agents/listening.ts   topic/concepts/topic-change/direct address
    ├─ Curriculum agent     lib/curriculum.ts         configured dataset; unverified labels otherwise
    ├─ Content agent        engine › writeReel        transcript → script plan → scenes (async)
    ├─ Validator            lib/agents/validator.ts   relevance, curriculum, age, quality, safety, integrity
    ├─ Voice agent          lib/voice.ts              speaks only in pauses, never over the teacher
    ├─ Quiz agent           engine › prepareQuiz
    └─ Assessment agent     lib/agents/assessment.ts  class/group-level only
          │
          ▼ BroadcastChannel
   Classroom display (/display)  ◄─ teacher pause / dismiss / revise
```

* **Agentic, not scripted:** every autonomous decision and its reasoning is written to the *Agent activity* trace (◆).
* **Non-blocking:** generation runs as background tasks with the statuses Planned → Generating → Validating → Ready → Presented (or Held / Failed / Cancelled).
* **Guardrails:** content is never auto-presented unless all required checks pass. There's a frequency limit, and curriculum references are never invented.
* **Privacy:** the mic status is always visible, raw audio is never stored, there are no cameras or faces, groups are anonymous, and sessions are only stored locally until reset.
* **Resilience:** the session survives a page reload, there are text and demo-voice fallbacks if the mic is denied, and failed generation drops back to a simpler diagram.

### Moving to the production stack (SRS §7.2)
The agent modules are plain TypeScript with no UI dependencies, so they can be ported to the recommended FastAPI + LangGraph backend. The browser STT/TTS can be replaced with a realtime voice API, `localStorage` with Supabase, and the async task runner with Redis/Celery workers.

## Curriculum data notice
`lib/curriculum.ts` is a **sample dataset** for the demo. Learning-standard codes are adapted for demonstration and must be checked against the official DSKP documents before real use. Entries not marked as verified are shown as **⚠ Unverified** in the UI.
