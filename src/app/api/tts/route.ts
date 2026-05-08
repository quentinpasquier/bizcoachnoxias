import { NextResponse } from "next/server";
import type { Gender } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";

// Voix OpenAI : alloy, echo, fable, onyx, nova, shimmer
// Sélection en fonction du genre du prospect
function pickVoice(gender: Gender): string {
  return gender === "femme" ? "nova" : "onyx";
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY non configurée. Le client utilisera la voix navigateur (Web Speech).",
      },
      { status: 503 },
    );
  }

  let body: { text?: string; gender?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const gender = (body.gender ?? "homme") as Gender;

  if (!text) {
    return NextResponse.json({ error: "Texte vide" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Texte trop long (max 4000 caractères)" }, { status: 400 });
  }

  const response = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: pickVoice(gender),
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
    },
  });
}

export async function GET() {
  // Permet au client de savoir si OpenAI TTS est disponible
  return NextResponse.json({
    available: Boolean(process.env.OPENAI_API_KEY),
  });
}
