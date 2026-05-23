import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";

// Prompt de vocabulaire pour biaiser Whisper vers le jargon commercial B2B.
// Whisper accepte jusqu'à ~244 tokens. On liste les termes les plus fréquents
// des cold calls francophones pour éviter les fautes typiques (par ex.
// "RDV" transcrit en "raidie vois", "ICP" en "i ces péter", "B2B" en
// "biéton biét").
const PROSPECTION_VOCAB_HINT =
  "Conversation commerciale B2B française. Vocabulaire : RDV, ICP, B2B, B to B, PME, ETI, SaaS, scale-up, prospect, persona, dirigeant, gérant, DG, DAF, DRH, DSI, CEO, COO, CTO, président, lead, qualification, closing, pipeline, démo, rendez-vous, cold call, prospection, agence, cabinet, briefing, KPI, ROI, MRR, ARR, BANT, MEDDIC, follow-up, deal, opportunité, brief, brise-glace.";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY non configurée côté serveur.",
      },
      { status: 503 },
    );
  }

  // Le client envoie un FormData avec `audio` (Blob) ; on relaie tel quel
  // à OpenAI en construisant un nouveau FormData côté serveur (l'API attend
  // un fichier nommé `file`).
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "FormData attendu (champ `audio` blob)." },
      { status: 400 },
    );
  }

  const audio = incoming.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "Champ `audio` manquant ou de mauvais type." },
      { status: 400 },
    );
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: "Audio vide." }, { status: 400 });
  }
  // Garde-fou : Whisper accepte 25 MB max.
  if (audio.size > 24 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Audio trop volumineux (max 24 MB)." },
      { status: 413 },
    );
  }

  // Le client peut passer un prompt extra pour ajouter du contexte (par ex.
  // le nom de l'offre, le persona…) sans remplacer le vocab par défaut.
  const extraPrompt = ((incoming.get("prompt") as string | null) ?? "").trim();
  const prompt = extraPrompt
    ? `${PROSPECTION_VOCAB_HINT} ${extraPrompt}`.slice(0, 1024)
    : PROSPECTION_VOCAB_HINT;

  // Détermine une extension de fichier propre pour OpenAI (Whisper accepte
  // webm, mp3, wav, m4a, mp4, mpeg, mpga, ogg, oga, flac). MediaRecorder
  // produit typiquement audio/webm côté Chrome.
  const mimeType = audio.type || "audio/webm";
  const ext = pickExtension(mimeType);

  const upstream = new FormData();
  upstream.append("file", audio, `recording.${ext}`);
  upstream.append("model", "whisper-1");
  upstream.append("language", "fr");
  upstream.append("response_format", "json");
  upstream.append("prompt", prompt);
  // Temperature à 0 pour des sorties déterministes (pas de "création").
  upstream.append("temperature", "0");

  const response = await fetch(OPENAI_TRANSCRIBE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: upstream,
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      {
        error: `Le cerveau IA n'a pas pu transcrire (${response.status}) : ${errText.slice(0, 300)}`,
      },
      { status: response.status },
    );
  }

  const data = (await response.json()) as { text?: string };
  const text = (data.text ?? "").trim();

  return NextResponse.json({ text });
}

export async function GET() {
  return NextResponse.json({ available: Boolean(process.env.OPENAI_API_KEY) });
}

function pickExtension(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}
