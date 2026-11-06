// Voice output (Voice Agent) via the browser's speech synthesis.
// Swappable for a realtime voice API in production.

export interface VoiceChoice {
  lang: string; // language prefix, e.g. "ms"
  voice: string; // exact browser voice name, or "" to pick one for the language
}

export class Speaker {
  get available() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => /en-GB/i.test(v.lang) && /female|libby|sonia|serena|google uk english female/i.test(v.name)) ||
      voices.find((v) => /en-(GB|US|AU)/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      voices[0]
    );
  }

  private resolveVoice(choice?: VoiceChoice) {
    if (!choice) return this.pickVoice();
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.name === choice.voice) ?? voices.find((v) => v.lang.toLowerCase().startsWith(choice.lang)) ?? this.pickVoice();
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
    u.rate = 1.02;
    u.pitch = 1.05;
    let ended = false;
    const end = () => {
      if (!ended) {
        ended = true;
        onEnd();
      }
    };
    u.onstart = onStart;
    u.onend = end;
    u.onerror = end;
    window.speechSynthesis.speak(u);
    // Safety net: some browsers never fire onend.
    setTimeout(end, 2500 + text.length * 90);
  }

  cancel() {
    if (this.available) window.speechSynthesis.cancel();
  }
}
