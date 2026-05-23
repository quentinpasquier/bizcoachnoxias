import { NextResponse } from "next/server";
import type { Gender } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";

// Pool de voix par genre, sélectionnées pour leur naturel en français
// métropolitain. La voix retenue varie d'une session à l'autre (déterministe
// via le seed pour rester stable au sein d'une session).
//
// Voix écartées sciemment :
// - fable : accent British, déplacé pour un prospect français
// - alloy : prononciation anglo-saxonne en français, "ti" mou
// - ash, sage, ballad, coral, verse : voix plus récentes mais variables
//   sur le français selon les modèles
const VOICES_HOMME = ["onyx", "echo"];
const VOICES_FEMME = ["nova", "shimmer"];

function pickVoice(gender: Gender, seed: string): string {
  const pool = gender === "femme" ? VOICES_FEMME : VOICES_HOMME;
  if (!seed) return pool[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % pool.length;
  return pool[idx];
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY non configurée. Le client utilise la voix navigateur (Web Speech).",
      },
      { status: 503 },
    );
  }

  let body: { text?: string; gender?: string; seed?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const gender = (body.gender ?? "homme") as Gender;
  const seed = body.seed ?? "";

  if (!text) {
    return NextResponse.json({ error: "Texte vide" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Texte trop long (max 4000 caractères)" }, { status: 400 });
  }

  const voice = pickVoice(gender, seed);

  const response = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1-hd",
      input: text,
      voice,
      response_format: "mp3",
      speed: 1.05,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      { error: `OpenAI TTS error ${response.status} : ${errText.slice(0, 300)}` },
      { status: response.status },
    );
  }

  const audioBuffer = await response.arrayBuffer();
  return new Response(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Voice": voice,
    },
  });
}

export async function GET() {
  return NextResponse.json({
    available: Boolean(process.env.OPENAI_API_KEY),
  });
}
