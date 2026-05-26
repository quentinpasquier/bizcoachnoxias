import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";

// Prompt vocabulaire pour biaiser Whisper vers le jargon commercial B2B.
// Whisper accepte jusqu'à ~244 tokens. CRITIQUE : ce prompt doit être une
// PHRASE NATURELLE et non une liste de termes séparés par virgules. Une
// liste type "RDV, ICP, B2B, PME" ressemble à une transcription possible
// et Whisper la recrache parfois telle quelle dans la sortie (bug bien
// documenté de prompt bleed). Une phrase prose contextualisée force
// Whisper à comprendre que c'est un échantillon de style, pas du contenu
// à reproduire.
const PROSPECTION_VOCAB_HINT =
  "Voici un exemple typique d'appel commercial B2B francophone. Le commercial appelle un dirigeant de PME ou d'ETI pour proposer un rendez-vous de quelques minutes. Il parle de prospection téléphonique, de qualification de contacts, de retour sur investissement, d'indicateurs de performance. Le dirigeant peut être DAF, DRH, DSI ou président. On évoque parfois des méthodes comme BANT ou MEDDIC.";

// Liste des hallucinations Whisper francophones bien documentées. Quand
// Whisper rencontre un silence ou un audio incompréhensible, il émet
// régulièrement des phrases issues de ses données d'entraînement (génériques
// de fin de vidéo YouTube, doublages, sous-titres communautaires). On les
// détecte et on rejette la transcription pour qu'elle ne soit pas envoyée
// au bot. Le client retombe alors sur le texte Web Speech.
const WHISPER_HALLUCINATIONS = [
  /sous-titr(?:age|es)\s*[:.]?\s*amara/i,
  /voix\s+(?:de\s+l['']interprète|off)/i,
  /merci\s+(?:à\s+tous\s+)?d['']avoir\s+regardé/i,
  /bienvenue\s+dans\s+cette\s+(?:nouvelle\s+)?vidéo/i,
  /abonnez-vous\s+(?:à\s+la\s+chaîne|à\s+ma\s+chaîne)/i,
  /(?:à\s+)?très\s+bientôt\s+sur\s+la\s+chaîne/i,
  /communauté\s+d['']amara/i,
  /n['']oubliez\s+pas\s+de\s+(?:liker|vous\s+abonner|cliquer)/i,
  /merci\s+pour\s+l['']attention/i,
  /merci\s+d['']avoir\s+suivi/i,
];

function isHallucination(text: string): boolean {
  return WHISPER_HALLUCINATIONS.some((re) => re.test(text));
}

// Détecte si la sortie Whisper est un écho du prompt (prompt bleed).
// Si plus de 70 % des mots significatifs de la sortie viennent du prompt,
// c'est qu'il n'y a pas eu de transcription réelle, juste du bleed.
function isPromptEcho(text: string, prompt: string): boolean {
  const toWords = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2);

  const promptWords = new Set(toWords(prompt));
  const textWords = toWords(text);
  if (textWords.length === 0 || textWords.length > 30) return false;
  const matches = textWords.filter((w) => promptWords.has(w)).length;
  return matches / textWords.length > 0.7;
}

// Détecte et déduplique les boucles d'hallucination Whisper.
// Whisper peut renvoyer "B2BB2B" (acronyme métier répété), "B2BB2B2B2B2B"
// (boucle longue), "c'est bon, c'est bon, c'est bon" (phrase répétée avec
// séparateur), ou encore "merci merci merci" (phrase répétée sans
// ponctuation) quand l'audio est très court ou que le prompt contient des
// répétitions. On nettoie ces patterns en cascade. Conservateur sur le
// texte général (3+ occurrences requises pour collapser), plus agressif
// sur les acronymes métier (B2B, ICP, DAF, RDV, MEDDIC...) où 2 occurrences
// suffisent puisque ces chaînes ne se répètent jamais naturellement.
function dedupeRepeats(text: string): string {
  if (!text) return text;
  let cleaned = text;

  // 1. Acronymes métier répétés (2+ occurrences). Pattern strict : commence
  //    par majuscule, 3 à 6 caractères au total, uppercase/digits seulement.
  //    Cible "B2BB2B" (B2B doublé), "RDVRDV", "ICPICPICP", "DAFDAF", etc.
  //    Sans risque de toucher du texte normal car aucun mot français
  //    régulier ne match ce pattern.
  cleaned = cleaned.replace(/([A-Z][A-Z0-9]{2,5})\1+/g, "$1");

  // 2. Boucles concaténées générales (3+ occurrences, conservateur).
  //    "abcabcabc" → "abc", "lalala" → "la". Ne touche pas "papa", "bonbon"
  //    (seulement 2 occurrences).
  cleaned = cleaned.replace(/(\S{2,20}?)\1{2,}/g, "$1");

  // 3. Phrases répétées avec ponctuation (3+ occurrences).
  //    "c'est bon, c'est bon, c'est bon" → "c'est bon"
  cleaned = cleaned.replace(
    /(\b[^.,;!?]{2,50}?)([.,;!?]\s*\1){2,}/gi,
    "$1",
  );

  // 4. Phrases répétées avec espace seul (3+ occurrences, min 4 chars).
  //    "merci merci merci" → "merci". Min 4 chars évite les faux positifs
  //    sur "ha ha ha" ou "bla bla bla".
  cleaned = cleaned.replace(/(\b[\wÀ-ÿ' ]{4,40}?)(\s+\1){2,}\b/gi, "$1");

  return cleaned.trim();
}

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
  const rawText = (data.text ?? "").trim();

  // Filtres anti-hallucination en cascade :
  // 1. Hallucinations connues (sous-titres Amara, voix de l'interprète...)
  // 2. Écho du prompt (Whisper a recraché le vocabulaire métier au lieu
  //    de transcrire le commercial)
  if (isHallucination(rawText)) {
    console.warn(`[transcribe] Hallucination Whisper rejetée : "${rawText.slice(0, 80)}"`);
    return NextResponse.json({ text: "" });
  }
  if (isPromptEcho(rawText, prompt)) {
    console.warn(`[transcribe] Prompt echo Whisper rejeté : "${rawText.slice(0, 80)}"`);
    return NextResponse.json({ text: "" });
  }

  const text = dedupeRepeats(rawText);
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
