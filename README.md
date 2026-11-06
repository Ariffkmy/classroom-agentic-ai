# 🎓 Agentic AI Smart Classroom

A voice-enabled AI teaching assistant that **listens to the lesson, works out the subject and topic on its own, and then decides for itself how to help the class understand it**: making a video, running a quiz or a story-based Class Challenge, re-explaining an idea, or staying quiet. It judges each step from group answers, while the teacher stays in control.

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
3. **On-device rules**: nothing to set up and no network needed, so the demo always works.

Modes 1 and 2 are agentic: Claude makes the decisions. Mode 3 is a scripted fallback, and the app says so: the Lesson agent panel shows *Offline: fixed rules decide*, and each decision is marked *Fixed rule*.

## How the agent works
The Lesson agent has one goal: most groups understand each key idea, shown by their answers, with as little disruption to teaching as possible. Each time something happens (the teacher has taught more, a video has finished, group answers are in), it runs one loop:

1. **Observe:** recent teaching, what has been shown, understanding by concept, its own recent decisions and how they turned out (`lib/agent/brain.ts`).
2. **Reflect:** Claude judges whether its last action worked.
3. **Decide:** Claude picks one action and gives its reason and what it expects to change (`lib/agent/prompts.ts`).
4. **Check:** code outside the model confirms the action is allowed (`permit` in `lib/agent/brain.ts`).
5. **Act:** the engine carries it out (`agentStep` in `lib/engine.ts`).

| Action | What it does |
|---|---|
| `wait` | Nothing yet |
| `make_video` | Makes a video in the background, shown at a natural pause |
| `prepare_quiz` | Writes a quiz in the background |
| `start_quiz` | Runs a quiz at the next pause |
| `start_challenge` | Runs a Class Challenge at the next pause |
| `reexplain` | Shows and speaks a short explanation at the next pause |
| `advise_teacher` | Tells only the teacher something privately |

**What the model cannot do.** It can only choose from this list, so classroom speech can never reach anything else. It cannot turn off these limits: the teacher's autonomy switches, the video frequency limit, one class activity at a time, three actions at most without new teaching or answers, 40 model decisions per lesson, and the accuracy and safety checks. Everything shown to the class waits for a natural pause, and the teacher can start or cancel it from the Lesson agent panel. The *Agent activity* trace records the model's real reasons, not pre-written text.

**Planning.** Once it knows the topic, the agent writes a plan of 3 to 5 steps towards its goal. The Lesson agent panel shows the plan and ticks steps off. When the evidence calls for it, the agent changes the plan and says why.

## Not disturbing the teacher
The AI prepares in silence. What reaches the class depends on two settings under *Teacher controls*:

* **Ask me first (on by default):** a ready item appears on the teacher's screen only. Say "show it", "later" or "skip", or use the buttons. "Later" holds it for 3 minutes.
* **Automatic (Ask me first off):** the AI picks the moment using *AI patience*. Normal waits for 7 seconds of silence and leaves 90 seconds between items. After a question to the class or an unfinished sentence, it waits 12 seconds longer.

The demo voice always runs automatically at its own quick pace, so the scripted demo can run through by itself. "Hey assistant, wait" pauses a video, and "Hey assistant, continue" resumes it.

## Class Challenge
A short story problem that groups solve on the shared display using answer cards, with no student devices. Claude writes three linked steps set in an everyday Malaysian situation. If most groups miss a step, the story pauses for an easier try before carrying on. There are no points or rankings, and groups work together on one story.

## Accuracy
Every generated video, quiz and challenge passes an accuracy check before students see it:

* **In code:** arithmetic is recomputed, and any drawn right-angled triangle is checked. This also works offline. It skips anything it can't fully read, such as lines with units or variables.
* **By Claude:** a separate review checks facts, answer keys and agreement with the teacher.

If the check fails, the errors go back to be fixed once. If it fails again, the content is held back and a safe fallback is used. A review can still miss an error, so the teacher remains the final check.

## Generating videos
Video generation brings in the logic from Reel Studio, rebuilt so it can run during a live lesson.

1. **Listen:** the last 14 segments the teacher said, plus the detected topic, concepts and objectives, become the input. Requests made to the AI ("Hey assistant…") are left out.
2. **Plan:** Claude writes Reel Studio's plan: a hook, one row per spoken sentence, and a closing group question (`lib/reel/prompt.ts`). Each row picks a visual block, such as a formula, triangle, flow or chart. Offline, `lib/reel/composer.ts` builds the plan from the teacher's own sentences.
3. **Check:** the plan is sanitised (`lib/reel/plan.ts`), then has to pass the seven automated checks.
4. **Play:** a port of Reel Studio's scene toolkit (`lib/reel/kit.ts`) draws the scenes with GSAP on a 16:9 stage, timed to the narration.

**Teachers control the style, not the script.** The *Video style* panel sets the look (5 themes), language, length, narrator voice and captions. The script can be read in the content studio but not edited. *Make a different version* rewrites it automatically.

**Differences from Reel Studio**

| | Reel Studio | This app |
|---|---|---|
| Time per video | 10–30+ minutes | About 20 seconds |
| Script approval | A person approves the plan | Automatic, then the seven checks |
| Scene source | Claude writes JavaScript | Claude picks from fixed data blocks, so generated text never runs as code |
| Output | 9:16 MP4 | Live 16:9 playback in the browser |
| Voice timing | Whisper word timings | Estimated, because browser speech has no timestamps |

Not brought across: MP4 export, the 7 canvas styles, talking-video mode, sound effects and music.

With Claude available, quizzes and challenges are written from what the teacher said. The built-in question set is the fallback for the three built-in topics. *Everyday example* and *simpler* answers still use pre-written text for those topics, and topic detection without a language model only knows those three.

## Talking to the AI
Start with "Hey assistant…". After each reply, a green prompt shows the AI is listening for 10 seconds, and the teacher can answer without the wake phrase:

* **Follow-ups** such as "why is that?" or "give me another one" get an answer that takes the last few turns into account.
* **"Thanks"** ends the conversation. Going back to teaching ends it too.
* **Interrupting:** saying "Hey assistant…" cuts the AI off mid-sentence. Other speech is ignored while it talks, so it doesn't react to its own voice.

The AI speaks like a person in the room. While a reply is on its way it says something like "Hmm, let me check it for you", and replies use everyday phrasing in the chosen language. Replies stream, so the AI starts speaking after its first sentence. With no wake phrase, the AI judges a follow-up from its wording and length (a question, or a short question-like phrase), so it can occasionally mistake a teaching line for a follow-up during that 10-second window.

### During a quiz or challenge
The teacher can run it by voice, with no wake phrase. Answers can also be tapped in.

* **Enter answers:** "everyone B", "they are answering B" or "group A, C".
* **Check:** "is that correct?" speaks the answer and highlights it on the display.
* **Move on:** "next question", "continue" or "show results".

Common mishearings of the wake phrase, such as "hey sister" and "a system", also work.

## 3-minute demo script

1. Open `/teacher` and click **📺 Open classroom display**. Move that window to the projector.
2. Click **▶ Start lesson**. No subject or topic is entered (AT-01).
3. Teach into the mic, or press **▶ Run** next to *Demo voice* to play the scripted Pythagoras lesson.
4. Watch the **AI's understanding** panel. It detects *Mathematics → Pythagoras' Theorem*, picks out concepts and maps them to KSSM Form 2 learning standards (AT-02/03).
5. Watch the **Lesson agent** panel. Once a complete idea has been taught, the agent decides what to do and gives its reason. The usual choice here is a video, written from what it just heard in the background while the lesson continues (AT-04).
6. Seven automated checks run (AT-05). Once they pass, the video plays with narration **at the next pause in the teacher's speech** (AT-06).
7. *"Hey assistant, give another everyday example."* The AI answers out loud and shows a card.
8. *"Hey assistant, prepare five questions."* The quiz goes on the display. Groups hold up answer cards and the teacher taps them in (or uses **🎲 Fill demo group answers**). Then click **📊 Analyse responses** (AT-09/10).
9. The Assessment agent flags weak concepts, and the Lesson agent decides what to do about them: another video, a re-explanation or a **Class Challenge**. Press **Close results** to let it start, or **Start now** in the Lesson agent panel. Its next decision says whether the last one worked (AT-11).
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
    ├─ Lesson agent         lib/agent/brain.ts        observe, decide, reflect; limits in `permit`
    ├─ Listening agent      lib/agents/listening.ts   topic/concepts/topic-change/direct address
    ├─ Curriculum agent     lib/curriculum.ts         configured dataset; unverified labels otherwise
    ├─ Content agent        engine › writeReel        transcript → script plan → scenes (async)
    ├─ Validator            lib/agents/validator.ts   relevance, curriculum, age, quality, safety, integrity, accuracy
    ├─ Voice agent          lib/voice.ts              speaks only in pauses, never over the teacher
    ├─ Quiz agent           engine › prepareQuiz, prepareChallenge
    └─ Assessment agent     lib/agents/assessment.ts  class/group-level only
          │
          ▼ BroadcastChannel
   Classroom display (/display)  ◄─ teacher pause / dismiss / revise
```

* **Model-led, with fixed rules offline:** with Claude available, the model chooses each action and gives its own reason. The Listening, Curriculum and Assessment steps remain ordinary code, because they don't need judgement. Each decision is labelled *AI decided* or *Fixed rule*.
* **Non-blocking:** generation runs as background tasks with the statuses Planned → Generating → Validating → Ready → Presented (or Held / Failed / Cancelled).
* **Guardrails:** content is never auto-presented unless all required checks pass. There's a frequency limit, and curriculum references are never invented.
* **Privacy:** the mic status is always visible, raw audio is never stored, there are no cameras or faces, groups are anonymous, and sessions are only stored locally until reset.
* **Resilience:** the session survives a page reload, there are text and demo-voice fallbacks if the mic is denied, and failed generation drops back to a simpler diagram.

### Moving to the production stack (SRS §7.2)
The agent modules are plain TypeScript with no UI dependencies, so they can be ported to the recommended FastAPI + LangGraph backend. The browser STT/TTS can be replaced with a realtime voice API, `localStorage` with Supabase, and the async task runner with Redis/Celery workers.

## Curriculum data notice
`data/syllabus.json` holds KSSR Semakan 2017 standards for Tahun 1 to 6, extracted from KPM DSKP documents and built by `scripts/build_syllabus.py`. It leaves out Pendidikan Khas and vernacular-school variants for now, and has no secondary (KSSM) data. The lookup runs on the server and needs no model (`app/api/syllabus/route.ts`). Each match links to its source document. "Verified" here describes the extraction quality, not an approval by KPM, so check the standards you rely on against the source PDF.

`lib/curriculum.ts` is a **sample dataset** for the demo. Its learning-standard codes are adapted for demonstration and must be checked against the official DSKP documents before real use. Entries not marked as verified are shown as **⚠ Unverified** in the UI.
