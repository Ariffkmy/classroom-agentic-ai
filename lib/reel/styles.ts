// Teacher-configurable reel options. Styles, briefs and language rules come from Reel Studio
// (prompts/styles.json, prompts/languages.json), adapted from 9:16 reels to a 16:9 classroom display.

import type { ReelConfig, ReelLanguageId, ReelStyleId } from "../types";

export interface ReelStyle {
  id: ReelStyleId;
  name: string;
  emoji: string;
  blurb: string;
  brief: string;
}

export const REEL_STYLES: ReelStyle[] = [
  { id: "paper", name: "Paper explainer", emoji: "📄", blurb: "Warm ruled paper, one tomato accent", brief: "Warm off-white ruled paper, near-black ink and one tomato accent. Each sentence gets one concrete object or card. Calm but busy enough." },
  { id: "storybook", name: "Storybook night", emoji: "🌙", blurb: "Navy sky, gentle and story-like", brief: "A bedtime-story look: deep navy night sky, a glowing moon, soft cream shapes and lamp yellow accents. Slow, gentle and warm." },
  { id: "blueprint", name: "Blueprint steps", emoji: "📐", blurb: "Grid paper, precise diagrams", brief: "Light grid paper with clean blue diagrams, like a walkthrough. Calm, precise, one step per sentence." },
  { id: "poster", name: "Halftone poster", emoji: "📰", blurb: "Loud headlines, red accent", brief: "Halftone paper with loud condensed uppercase headlines and one red word. Punchy, a new visual every sentence." },
  { id: "neon", name: "Dark neon data", emoji: "📟", blurb: "Dark grid, glowing numbers", brief: "Near-black grid with drifting particles: a dramatic data explainer with one big glowing number per beat." },
];

export interface ReelLanguage {
  id: ReelLanguageId;
  label: string;
  wps: number; // spoken words per second
  speech: string; // BCP-47 prefix used to find a voice
  rules: string;
}

export const REEL_LANGUAGES: ReelLanguage[] = [
  { id: "en", label: "English", wps: 2.6, speech: "en", rules: "Write everything (spoken lines and on-screen text) in natural, plain English." },
  { id: "ms-formal", label: "Bahasa Melayu (formal)", wps: 2.3, speech: "ms", rules: "Write everything (spoken lines and on-screen text) in standard, clear Bahasa Melayu (bahasa baku), polite and easy to follow, no slang. Spell numbers as words in spoken lines." },
  { id: "ms-casual", label: "Bahasa Melayu (santai)", wps: 2.3, speech: "ms", rules: "Write everything (spoken lines and on-screen text) in friendly everyday Malaysian Malay suitable for a classroom: short sentences, warm tone, light everyday words, nothing rude. Spell numbers as words in spoken lines." },
  { id: "mixed", label: "Malay + English (mixed)", wps: 2.4, speech: "en", rules: "Keep the teacher's natural mix of Malay and English exactly as spoken; on-screen text uses their own words." },
];

export const REEL_LENGTHS = [20, 30, 45, 60];

export const DEFAULT_REEL: ReelConfig = { style: "paper", language: "en", lengthSec: 30, captions: true, voice: "" };

export const reelStyle = (id: ReelStyleId) => REEL_STYLES.find((s) => s.id === id) ?? REEL_STYLES[0];
export const reelLanguage = (id: ReelLanguageId) => REEL_LANGUAGES.find((l) => l.id === id) ?? REEL_LANGUAGES[0];

export const DISCUSS_LABEL: Record<ReelLanguageId, string> = {
  en: "Discuss in your group",
  "ms-formal": "Bincangkan dalam kumpulan",
  "ms-casual": "Bincang dalam kumpulan",
  mixed: "Discuss dalam group",
};
