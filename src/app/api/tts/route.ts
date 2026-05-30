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

  let body: {
    text?: string;
    gender?: string;
    seed?: string;
    role?: "prospect" | "coach";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const gender = (body.gender ?? "homme") as Gender;
  const seed = body.seed ?? "";
  const role = body.role === "coach" ? "coach" : "prospect";

  if (!text) {
    return NextResponse.json({ error: "Texte vide" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Texte trop long (max 4000 caractères)" }, { status: 400 });
  }

  // Le coach embarqué (Mode 2) utilise une voix FIXE différente du prospect
  // pour que le commercial entende immédiatement la différence : c'est le
  // coach qui intervient, pas le prospect. Voix Onyx (homme grave, posé),
  // avec instructions de ton pédagogique au lieu du ton dirigeant pressé.
  const voice = role === "coach" ? "onyx" : pickVoice(gender, seed);

  const instructions =
    role === "coach"
      ? "Parle en français de France métropolitain, accent neutre. Ton : COACH commercial pédagogique, calme, posé, BIENVEILLANT mais ferme sur la précision. Tu n'es PAS pressé. Tu articules clairement, tu prends le temps. C'est l'inverse du prospect : tu rassures et tu guides. Légère gravité dans la voix, autorité naturelle d'un mentor."
      : "Parle en français de France métropolitain, accent neutre parisien (jamais québécois, jamais belge, jamais suisse). Ton : professionnel mais dynamique, légèrement pressé comme un dirigeant qui vient de prendre un appel imprévu de prospection commerciale. Articule naturellement, sans exagérer. Les hésitations courtes (\"euh\", \"hum\") sont permises si elles sont dans le texte, mais ne les ajoute pas. Rythme : conversationnel, pas posé comme une lecture.";

  const response = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      input: text,
      voice,
      instructions,
      response_format: "mp3",
      speed: 1.08,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      { error: `OpenAI TTS error ${response.status} : ${errText.slice(0, 300)}` },
      { status: response.status },
    );
  }

  // Streaming passe-plat : on relaie directement le ReadableStream OpenAI
  // au client sans accumuler en arrayBuffer. Le client (via MediaSource
  // Extensions) commence à jouer dès le premier chunk MP3, ce qui économise
  // ~1-1.5s de latence perçue par rapport au mode buffered (où l'on
  // attendait que tout l'audio soit téléchargé avant la lecture).
  if (!response.body) {
    return NextResponse.json(
      { error: "OpenAI TTS : pas de corps de réponse" },
      { status: 502 },
    );
  }
  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Voice": voice,
      // Pas de Content-Length : Transfer-Encoding chunked automatique.
    },
  });
}

export async function GET() {
  return NextResponse.json({
    available: Boolean(process.env.OPENAI_API_KEY),
  });
}
