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

### Optional: real LLM
Copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. The key is only read server-side (`app/api/ai/route.ts`).
Without a key, everything runs on deterministic on-device agents, so the demo never depends on the network.

## 3-minute demo script

1. Open `/teacher` and click **📺 Open classroom display**. Move that window to the projector.
2. Click **▶ Start lesson**. No subject or topic is entered (AT-01).
3. Teach into the mic, or press **▶ Run** next to *Demo voice* to play the scripted Pythagoras lesson.
4. Watch the **AI's understanding** panel. It detects *Mathematics → Pythagoras' Theorem*, picks out concepts and maps them to KSSM Form 2 learning standards (AT-02/03).
5. After the teacher explains *a² + b² = c²*, the orchestrator decides on its own to make a ladder-and-wall animation. It renders in the background while the lesson continues (AT-04).
6. Six automated checks run (AT-05). Once they pass, the animation plays with narration **at the next pause in the teacher's speech** (AT-06).
7. *"Hey assistant, give another everyday example."* The AI answers out loud and shows a card.
8. *"Hey assistant, prepare five questions."* The quiz goes on the display. Groups hold up answer cards and the teacher taps them in (or uses **🎲 Fill demo group answers**). Then click **📊 Analyse responses** (AT-09/10).
9. The Assessment agent flags Q3 (identifying the hypotenuse) and creates a **follow-up animation** on its own (AT-11).
10. **Failure drills:** under *Teacher controls → Failure drill*, pick *Video provider fails* (AT-12) or *Content fails a check* (AT-07). The lesson keeps going and a safe fallback diagram is shown.
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
    ├─ Content agent        engine › runContentTask   brief → storyboard → render → narration (async)
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
The agent modules are plain TypeScript with no UI dependencies, so they can be ported to the recommended FastAPI + LangGraph backend. The browser STT/TTS can be replaced with a realtime voice API, the on-device renderer with video-generation APIs, `localStorage` with Supabase, and the async task runner with Redis/Celery workers.

## Curriculum data notice
`lib/curriculum.ts` is a **sample dataset** for the demo. Learning-standard codes are adapted for demonstration and must be checked against the official DSKP documents before real use. Entries not marked as verified are shown as **⚠ Unverified** in the UI.
