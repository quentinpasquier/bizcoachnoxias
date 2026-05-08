// Helpers Web Speech API : TTS (parole prospect) + STT (parole commercial).
// Tout fonctionne côté navigateur, sans backend, sans coût.

import type { Gender } from "./supabase/types";

// ---------- Speech Synthesis (TTS) ----------

let cachedVoices: SpeechSynthesisVoice[] | null = null;

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve([]);
      return;
    }

    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      cachedVoices = existing;
      resolve(existing);
      return;
    }

    const handler = () => {
      const voices = window.speechSynthesis.getVoices();
      cachedVoices = voices;
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(voices);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);

    // Safety fallback : si l'event ne se déclenche pas après 1s
    setTimeout(() => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        cachedVoices = voices;
        window.speechSynthesis.removeEventListener("voiceschanged", handler);
        resolve(voices);
      }
    }, 1000);
  });
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (cachedVoices) return cachedVoices;
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

// Heuristique simple : choisit une voix française qui matche le genre.
// Fallback : première voix française dispo, puis n'importe quelle voix.
export function pickFrenchVoice(gender: Gender): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (voices.length === 0) return null;

  const french = voices.filter((v) => v.lang.toLowerCase().startsWith("fr"));
  if (french.length === 0) return voices[0] ?? null;

  // Mots-clés par genre — pas parfait mais marche sur la plupart des OS.
  const masculineKeywords = [
    "thomas",
    "henri",
    "paul",
    "sebastien",
    "guillaume",
    "homme",
    "male",
    "man",
    "daniel",
  ];
  const feminineKeywords = [
    "amelie",
    "audrey",
    "aurelie",
    "marie",
    "celine",
    "virginie",
    "sophie",
    "femme",
    "female",
    "woman",
    "hortense",
    "julie",
  ];

  const targets = gender === "homme" ? masculineKeywords : feminineKeywords;

  for (const v of french) {
    const name = v.name.toLowerCase();
    if (targets.some((kw) => name.includes(kw))) {
      return v;
    }
  }

  // Fallback : première voix française "normale" (pas Compact)
  const standard = french.find((v) => !v.name.toLowerCase().includes("compact"));
  return standard ?? french[0];
}

export interface SpeakOptions {
  text: string;
  gender: Gender;
  rate?: number; // 0.1 - 10, défaut 1
  pitch?: number; // 0 - 2, défaut 1
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: SpeechSynthesisErrorEvent) => void;
}

export function speak(opts: SpeakOptions): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  // Coupe ce qui était en cours
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(opts.text);
  utterance.lang = "fr-FR";
  utterance.rate = opts.rate ?? 1.05;
  utterance.pitch = opts.pitch ?? (opts.gender === "homme" ? 0.95 : 1.05);

  const voice = pickFrenchVoice(opts.gender);
  if (voice) utterance.voice = voice;

  if (opts.onStart) utterance.addEventListener("start", opts.onStart);
  if (opts.onEnd) utterance.addEventListener("end", opts.onEnd);
  if (opts.onError) {
    utterance.addEventListener("error", (e) =>
      opts.onError!(e as SpeechSynthesisErrorEvent),
    );
  }

  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// ---------- Speech Recognition (STT) ----------

interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && Boolean(window.speechSynthesis);
}

export function createRecognition(): MinimalSpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = "fr-FR";
  recognition.continuous = false;
  recognition.interimResults = true;
  return recognition;
}

export type { MinimalSpeechRecognition, SpeechRecognitionEvent };
