import { getAnthropic, PROSPECT_MODEL } from "./anthropic";
import { buildProspectSystemPrompt } from "./personas";
import type { Client, Difficulty, Gender, Scenario } from "./supabase/types";

export interface ConversationTurn {
  role: "user" | "prospect";
  content: string;
}

export interface ProspectReply {
  text: string;
  signal: ProspectSignal;
  progress: ProgressTags;
}

export type ProspectSignal =
  | { type: "continue" }
  | { type: "hangup"; reason: string }
  | { type: "appointment"; date: string };

export type CallStage =
  | "brise_glace"
  | "presentation"
  | "ouverture"
  | "objections"
  | "action";

// Catégories de delta émises par le bot persona pour qualifier la nature
// du geste du commercial. 6 positives + 6 négatives. Sert à afficher un
// label court "+1 · Bonne question" / "-1 · Pitch déroulé" sur la barre
// CallPipeline et à enrichir le débrief de fin de session.
export type DeltaCategory =
  | "bonne-question"
  | "acquittement"
  | "benefice-chiffre"
  | "reformulation"
  | "creneau-precis"
  | "relance-tenue"
  | "pitch-deroule"
  | "question-fermee"
  | "capitulation"
  | "baratin"
  | "esquive"
  | "agressivite";

const VALID_DELTA_CATEGORIES: ReadonlySet<DeltaCategory> = new Set<DeltaCategory>([
  "bonne-question",
  "acquittement",
  "benefice-chiffre",
  "reformulation",
  "creneau-precis",
  "relance-tenue",
  "pitch-deroule",
  "question-fermee",
  "capitulation",
  "baratin",
  "esquive",
  "agressivite",
]);

export interface ProgressTags {
  stage?: CallStage;
  delta?: "+" | "-";
  deltaCategory?: DeltaCategory;
}

const SIGNAL_REGEX =
  /\[(HANGUP|APPOINTMENT|CONTINUE)(?::([^\]]+))?\]/i;
const STAGE_REGEX =
  /\[STAGE:\s*(brise_glace|presentation|ouverture|objections|action)\s*\]/i;
// Catégorie optionnelle après le signe : [DELTA:+:bonne-question]
// Si Claude ne respecte pas le format avec catégorie, on accepte aussi le
// format historique [DELTA:+] pour ne pas régresser sur les anciens prompts.
const DELTA_REGEX = /\[DELTA:\s*([+-])\s*(?::\s*([a-z-]+)\s*)?\]/i;

// Patterns de narration que Claude émet parfois malgré l'interdiction.
// La prospect doit JOUER le silence ou la pause, pas l'annoncer.
// Capture : "*silence*", "*Pause*", "**soupire**", "*il rit*", etc.
const NARRATION_ASTERISK_REGEX = /\*+[^*\n]*\*+/g;
// Capture les didascalies entre crochets sans préfixe métier (STAGE, HANGUP...).
// Ex : "[silence]", "[soupire profondément]", "[un temps]".
const NARRATION_BRACKETS_REGEX =
  /\[(?!STAGE\b|HANGUP\b|APPOINTMENT\b|CONTINUE\b|DELTA\b)[^\]]+\]/gi;
// Capture les didascalies entre parenthèses pour les mots-clés scéniques
// courants ; on évite de toucher aux parenthèses qui contiennent une vraie
// précision (chiffres, dates, motifs).
const NARRATION_PARENS_REGEX =
  /\(\s*(silence|pause|soupir[e]?|soupire\s\w+|rire?|rit|tousse|raclement\sde\sgorge|h[ée]site\s?\w*|h[ée]sitation|respire|murmure|chuchote|aparte?)[^)]{0,30}\)/gi;

function stripNarration(text: string): string {
  return text
    .replace(NARRATION_ASTERISK_REGEX, "")
    .replace(NARRATION_BRACKETS_REGEX, "")
    .replace(NARRATION_PARENS_REGEX, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

function parseSignal(raw: string): {
  text: string;
  signal: ProspectSignal;
  progress: ProgressTags;
} {
  let working = raw;
  const progress: ProgressTags = {};

  const stageMatch = working.match(STAGE_REGEX);
  if (stageMatch) {
    progress.stage = stageMatch[1]!.toLowerCase() as CallStage;
    working = working.replace(stageMatch[0], "");
  }

  const deltaMatch = working.match(DELTA_REGEX);
  if (deltaMatch) {
    progress.delta = deltaMatch[1] as "+" | "-";
    const rawCategory = deltaMatch[2]?.toLowerCase() as DeltaCategory | undefined;
    if (rawCategory && VALID_DELTA_CATEGORIES.has(rawCategory)) {
      progress.deltaCategory = rawCategory;
    }
    working = working.replace(deltaMatch[0], "");
  }

  // Filtre anti-narration : Claude continue parfois à émettre des incises
  // scéniques (*silence*, *Pause*, *soupire*, **rit**) malgré l'interdiction
  // explicite du prompt système. On les strip ici pour qu'elles ne soient
  // jamais vocalisées par le TTS ni affichées au commercial.
  working = stripNarration(working);

  const match = working.match(SIGNAL_REGEX);
  if (!match) {
    return {
      text: working.trim(),
      signal: { type: "continue" },
      progress,
    };
  }

  const [full, type, payload] = match;
  const text = working.replace(full, "").trim();
  const upper = type.toUpperCase();

  if (upper === "HANGUP") {
    const reasonMatch = payload?.match(/reason\s*=\s*"([^"]*)"/i);
    return {
      text,
      signal: { type: "hangup", reason: reasonMatch?.[1] ?? "Pas intéressé" },
      progress,
    };
  }

  if (upper === "APPOINTMENT") {
    const dateMatch = payload?.match(/date\s*=\s*"([^"]*)"/i);
    return {
      text,
      signal: { type: "appointment", date: dateMatch?.[1] ?? "À convenir" },
      progress,
    };
  }

  return { text, signal: { type: "continue" }, progress };
}

export async function generateProspectReply(args: {
  difficulty: Difficulty;
  gender: Gender;
  client: Client;
  scenario: Scenario;
  history: ConversationTurn[];
}): Promise<ProspectReply> {
  const commercialTurns = args.history.filter((t) => t.role === "user").length;

  const system = buildProspectSystemPrompt({
    scenario: args.scenario,
    difficulty: args.difficulty,
    gender: args.gender,
    client: args.client,
    commercialTurns,
  });

  const messages = args.history.map((turn) => ({
    role: (turn.role === "user" ? "user" : "assistant") as "user" | "assistant",
    content: turn.content,
  }));

  if (messages.length === 0) {
    messages.push({
      role: "user",
      content: "[Le téléphone sonne. Tu décroches.]",
    });
  }

  // Prompt caching Anthropic : le system prompt du persona pèse ~3000 tokens
  // (identité + douleurs + KPIs + objections + règles d'oralité + règles de
  // fin propre, etc.). Il est quasi-stable au sein d'une session (seul le
  // pressureLine en fin varie aux paliers 0/2/5/8 tours commercial). On le
  // marque cache_control:ephemeral : le 1er appel paye le write, les tours
  // suivants tapent le cache et gagnent 3-8s d'ingestion par réplique du
  // prospect. C'est ce qui transforme un échange à 5-8s/réplique en un vrai
  // ping-pong à 1-3s/réplique.
  const response = await getAnthropic().messages.create({
    model: PROSPECT_MODEL,
    max_tokens: 220,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Réponse du cerveau IA vide");
  }

  return parseSignal(textBlock.text);
}
