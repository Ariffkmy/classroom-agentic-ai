// Voice output (Voice Agent) via the browser's speech synthesis.
// Swappable for a realtime voice API in production.

export interface VoiceChoice {
  lang: string; // language prefix, e.g. "ms"
  voice: string; // exact browser voice name, or "" to pick one for the language
}

type VoiceInfo = Pick<SpeechSynthesisVoice, "name" | "lang" | "localService">;

/** Edge names its best voices "Online (Natural)"; Google, Apple and others have their own labels. */
export const isNaturalVoice = (v: VoiceInfo) => /natural|neural|premium|enhanced|^google /i.test(v.name);

function score(v: VoiceInfo) {
  return (/natural|neural/i.test(v.name) ? 8 : isNaturalVoice(v) ? 4 : 0) + (/^en-GB/i.test(v.lang) ? 2 : 0) + (/female|sonia|libby|yasmin/i.test(v.name) ? 1 : 0);
}

export const rankVoices = <T extends VoiceInfo>(voices: T[]) => [...voices].sort((a, b) => score(b) - score(a));

export function bestVoice<T extends VoiceInfo>(voices: T[], lang: string): T | undefined {
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
  return rankVoices(matching.length ? matching : voices)[0];
}

export class Speaker {
  private remoteFailed = false; // once a cloud voice fails, stop trying them this session

  get available() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private resolveVoice(choice?: VoiceChoice) {
    const all = window.speechSynthesis.getVoices();
    const voices = this.remoteFailed ? all.filter((v) => v.localService) : all;
    const picked = choice?.voice ? voices.find((v) => v.name === choice.voice) : undefined;
    return picked ?? bestVoice(voices.length ? voices : all, choice?.lang ?? "en");
  }

  speak(text: string, onStart: () => void, onEnd: () => void, choice?: VoiceChoice) {
    if (!this.available) {
      onStart();
      setTimeout(onEnd, Math.min(8000, 400 + text.length * 55));
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    const v = this.resolveVoice(choice);
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    // Natural voices already have their own rhythm, and changing the pitch makes them sound off.
    const natural = v && isNaturalVoice(v);
    u.rate = natural ? 1 : 1.02;
    u.pitch = natural ? 1 : 1.05;
    let ended = false;
    let retried = false;
    const end = () => {
      if (!ended) {
        ended = true;
        onEnd();
      }
    };
    u.onstart = onStart;
    u.onend = () => {
      if (!retried) end();
    };
    u.onerror = (e) => {
      // Cloud voices need the internet. If one fails mid-lesson, say it again with a local voice.
      if (v && !v.localService && e.error !== "canceled" && e.error !== "interrupted") {
        this.remoteFailed = true;
        retried = true;
        const retry = new SpeechSynthesisUtterance(text);
        const local = this.resolveVoice(choice);
        if (local) {
          retry.voice = local;
          retry.lang = local.lang;
        }
        retry.onend = end;
        retry.onerror = end;
        window.speechSynthesis.speak(retry);
        return;
      }
      end();
    };
    window.speechSynthesis.speak(u);
    // Safety net: some browsers never fire onend.
    setTimeout(end, 2500 + text.length * 90);
  }

  cancel() {
    if (this.available) window.speechSynthesis.cancel();
  }
}
