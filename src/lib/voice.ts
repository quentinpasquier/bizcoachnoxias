// Helpers vocaux : TTS (parole prospect) + STT (parole commercial).
// TTS : OpenAI en priorité (qualité), fallback Web Speech (gratuit).
// STT : Web Speech API (gratuit, en local navigateur).

import type { Gender } from "./supabase/types";

// ====================================================================
// Speech Synthesis (TTS). Web Speech API (fallback navigateur)
// ====================================================================

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

export function pickFrenchVoice(gender: Gender): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (voices.length === 0) return null;

  const french = voices.filter((v) => v.lang.toLowerCase().startsWith("fr"));
  if (french.length === 0) return voices[0] ?? null;

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
    "remi",
    "rémi",
    "jean",
    "yves",
    "antoine",
    "claude",
    "nicolas",
  ];
  const feminineKeywords = [
    "amelie",
    "amélie",
    "audrey",
    "aurelie",
    "aurélie",
    "marie",
    "celine",
    "céline",
    "virginie",
    "sophie",
    "femme",
    "female",
    "woman",
    "hortense",
    "julie",
    "lea",
    "léa",
    "denise",
    "brigitte",
  ];

  const qualityKeywords = [
    "premium",
    "enhanced",
    "neural",
    "natural",
    "online",
    "siri",
    "wavenet",
    "studio",
  ];
  const lowQualityKeywords = ["compact", "espeak"];

  const genderTargets = gender === "homme" ? masculineKeywords : feminineKeywords;
  const oppositeTargets = gender === "homme" ? feminineKeywords : masculineKeywords;

  const scored = french.map((v) => {
    const name = v.name.toLowerCase();
    let score = 0;

    if (genderTargets.some((kw) => name.includes(kw))) score += 100;
    if (oppositeTargets.some((kw) => name.includes(kw))) score -= 100;

    if (qualityKeywords.some((kw) => name.includes(kw))) score += 50;
    if (lowQualityKeywords.some((kw) => name.includes(kw))) score -= 30;

    if (v.localService === false) score += 20;
    if (v.lang.toLowerCase() === "fr-fr") score += 5;
    if (v.default) score += 1;

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);

  if (typeof window !== "undefined" && scored[0]) {
    console.info(
      `[TTS] Voix navigateur : ${scored[0].voice.name} (score ${scored[0].score})`,
    );
  }

  return scored[0]?.voice ?? french[0] ?? null;
}

interface SpeakOptions {
  text: string;
  gender: Gender;
  seed?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Event) => void;
}

function speakWebSpeech(opts: SpeakOptions): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

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
    utterance.addEventListener("error", (e) => opts.onError!(e));
  }

  window.speechSynthesis.speak(utterance);
  return utterance;
}

// ====================================================================
// OpenAI TTS. qualité supérieure, via /api/tts
// ====================================================================

let openaiAvailableCache: boolean | null = null;
let openaiAvailableCacheTime = 0;
const OPENAI_CACHE_TTL = 30000; // 30 sec

export async function isOpenAITtsAvailable(): Promise<boolean> {
  const now = Date.now();
  if (
    openaiAvailableCache !== null &&
    now - openaiAvailableCacheTime < OPENAI_CACHE_TTL
  ) {
    return openaiAvailableCache;
  }
  try {
    const res = await fetch("/api/tts");
    if (!res.ok) {
      openaiAvailableCache = false;
      openaiAvailableCacheTime = now;
      return false;
    }
    const data = (await res.json()) as { available?: boolean };
    openaiAvailableCache = Boolean(data.available);
    openaiAvailableCacheTime = now;
    return openaiAvailableCache;
  } catch {
    openaiAvailableCache = false;
    openaiAvailableCacheTime = now;
    return false;
  }
}

export function clearTtsCache(): void {
  openaiAvailableCache = null;
  openaiAvailableCacheTime = 0;
}

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

function stopOpenAIAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = "";
    } catch {}
    currentAudio = null;
  }
  if (currentObjectUrl) {
    try {
      URL.revokeObjectURL(currentObjectUrl);
    } catch {}
    currentObjectUrl = null;
  }
}

async function speakOpenAI(opts: SpeakOptions): Promise<boolean> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: opts.text,
        gender: opts.gender,
        seed: opts.seed ?? "",
      }),
    });
    if (!res.ok) return false;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    stopOpenAIAudio();
    currentObjectUrl = url;
    const audio = new Audio(url);
    currentAudio = audio;

    audio.addEventListener("play", () => opts.onStart?.());
    audio.addEventListener("ended", () => {
      opts.onEnd?.();
      stopOpenAIAudio();
    });
    audio.addEventListener("error", (e) => {
      opts.onError?.(e as unknown as Event);
      stopOpenAIAudio();
    });

    await audio.play();
    return true;
  } catch (err) {
    opts.onError?.(err as Event);
    return false;
  }
}

export type TtsEngine = "openai" | "webspeech";

export interface SpeakResult {
  engine: TtsEngine;
}

// Point d'entrée unique pour parler. Tente OpenAI puis Web Speech.
// Renvoie l'engine effectivement utilisé.
export async function speak(
  opts: SpeakOptions & { preferOpenAI?: boolean },
): Promise<SpeakResult> {
  const prefer = opts.preferOpenAI ?? true;

  if (prefer) {
    const openAIAvailable = await isOpenAITtsAvailable();
    if (openAIAvailable) {
      const ok = await speakOpenAI(opts);
      if (ok) {
        if (typeof window !== "undefined") {
          console.info("[TTS] Engine: OpenAI (tts-1-hd)");
        }
        return { engine: "openai" };
      }
    }
  }

  if (typeof window !== "undefined") {
    console.warn(
      "[TTS] Engine: Web Speech API (fallback). OpenAI non disponible.",
    );
  }
  speakWebSpeech(opts);
  return { engine: "webspeech" };
}

export function stopSpeaking(): void {
  stopOpenAIAudio();
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// ====================================================================
// Speech Recognition (STT). Web Speech API
// ====================================================================

interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
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

export function createRecognition(
  options: { continuous?: boolean } = {},
): MinimalSpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = "fr-FR";
  // continuous: true → écoute en boucle (manuel)
  // continuous: false → s'arrête tout seul après un silence (auto-VAD)
  recognition.continuous = options.continuous ?? true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;
  return recognition;
}

export type { MinimalSpeechRecognition, SpeechRecognitionEvent };

// =====================================================================
// MediaRecorder + Whisper backend : transcription haute qualité côté
// serveur en complément du Web Speech (qui sert pour la preview interim).
// =====================================================================

// Demande l'accès micro avec les contraintes audio qui aident le plus la
// transcription : noise suppression, echo cancellation, auto gain control.
// Le stream retourné est partagé entre MediaRecorder et SpeechRecognition.
export async function requestMicrophoneStream(): Promise<MediaStream | null> {
  if (typeof window === "undefined") return null;
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
  } catch {
    return null;
  }
}

// Choisit le mimeType MediaRecorder le mieux supporté par le navigateur.
// Whisper accepte webm/opus, mp4, ogg : on prend ce qui est dispo.
export function pickRecorderMimeType(): string | undefined {
  if (typeof window === "undefined") return undefined;
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

// Envoie un blob audio à /api/transcribe et renvoie la transcription.
// Si le backend est indisponible (pas d'OPENAI_API_KEY), renvoie null pour
// que l'appelant retombe sur la transcription Web Speech.
export async function transcribeAudio(
  blob: Blob,
  options: { prompt?: string; signal?: AbortSignal } = {},
): Promise<string | null> {
  const form = new FormData();
  form.append("audio", blob, `recording.${blob.type.includes("ogg") ? "ogg" : "webm"}`);
  if (options.prompt) form.append("prompt", options.prompt);

  try {
    const res = await fetch("/api/transcribe", {
      method: "POST",
      body: form,
      signal: options.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    return (data.text ?? "").trim() || null;
  } catch {
    return null;
  }
}

// Indique si Whisper est dispo côté backend (clé OpenAI configurée).
// Vérifié 1× par session via le client pour ne pas faire la requête à chaque
// début d'écoute. Met en cache le résultat.
let whisperAvailableCache: boolean | null = null;
export async function isWhisperAvailable(): Promise<boolean> {
  if (whisperAvailableCache !== null) return whisperAvailableCache;
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/api/transcribe", { method: "GET" });
    if (!res.ok) {
      whisperAvailableCache = false;
      return false;
    }
    const data = (await res.json()) as { available?: boolean };
    whisperAvailableCache = Boolean(data.available);
    return whisperAvailableCache;
  } catch {
    whisperAvailableCache = false;
    return false;
  }
}
