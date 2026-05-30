import { getAnthropic } from "./anthropic";
import type {
  BlockTarget,
  Difficulty,
  Evaluation,
  MessageRow,
  SessionRow,
  TrainingMode,
} from "./supabase/types";

// Scan IA d'un commercial : analyse de ses 5 dernières sessions complètes
// (transcripts + évaluations + delta_category) pour ressortir les patterns
// récurrents observés et un plan d'action ciblé. Lancé manuellement par
// le manager depuis /manager, mis en cache 24h.

export interface SessionForScan {
  session: SessionRow;
  /** Messages user + prospect dans l'ordre chronologique. */
  messages: Pick<MessageRow, "role" | "content" | "metadata">[];
}

export interface RecurringDefect {
  /** Nom du défaut, en mots simples (max 6 mots). */
  name: string;
  /** Combien de fois observé sur les 5 sessions (count agrégé). */
  occurrences: number;
  /** Citation EXACTE d'un commercial sur une des sessions, pour preuve. */
  evidence_quote: string;
  /** Pourquoi c'est un problème, en 1 phrase mots simples. */
  why_it_matters: string;
}

export interface ActionAxis {
  /** Titre court de l'axe (max 8 mots). */
  title: string;
  /** Description concrète, 1-2 phrases mots simples. */
  description: string;
  /** Phrase orale prête à dire pour s'entraîner. */
  example_phrase: string;
}

export interface ScanRecommendation {
  mode: TrainingMode;
  blockTarget: BlockTarget | null;
  difficulty: Difficulty;
  /** Phrase courte qui dit quoi faire dans les 3 prochaines sessions. */
  next_3_sessions: string;
}

export interface CoachScanResult {
  /** Synthèse en 2-3 phrases de l'état actuel du commercial. */
  overall_diagnosis: string;
  /** 3 défauts récurrents observés (triés du plus au moins fréquent). */
  recurring_defects: RecurringDefect[];
  /** 3 axes de travail prioritaires. */
  action_axes: ActionAxis[];
  /** Plan recommandé pour les prochaines sessions. */
  recommendation: ScanRecommendation;
  /** Encouragement court (1 phrase) pour boucler positif. */
  encouragement: string;
}

const SCAN_MODEL = "claude-sonnet-4-6";
const SCAN_TIMEOUT_MS = 60000;

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}\n[…]` : s;
}

export async function scanCommercial(args: {
  commercialName: string;
  sessions: SessionForScan[];
}): Promise<CoachScanResult> {
  const { commercialName, sessions } = args;

  if (sessions.length === 0) {
    throw new Error("Aucune session à analyser.");
  }

  // Format compact de chaque session pour le prompt : metadata clé +
  // transcript tronqué + score + résumé évaluation si dispo.
  const sessionsBlock = sessions
    .map((s, i) => {
      const transcript = s.messages
        .filter((m) => m.role === "user" || m.role === "prospect")
        .map(
          (m) =>
            `${m.role === "user" ? "COMMERCIAL" : "PROSPECT"}: ${truncate(m.content, 280)}`,
        )
        .join("\n");

      const evaluation = s.session.evaluation as Evaluation | null;
      const outcome = s.session.appointment_secured
        ? "RDV obtenu"
        : s.session.ended_by === "prospect"
          ? "Prospect a raccroché"
          : "Appel terminé";

      const evalSummary = evaluation
        ? `\nNote /100 : ${evaluation.overall_score}\nOutcome summary : ${truncate(typeof evaluation.outcome_summary === "string" ? evaluation.outcome_summary : "", 400)}`
        : "";

      return `=== SESSION ${i + 1} (${s.session.training_mode}${
        s.session.block_target ? ` · bloc ${s.session.block_target}` : ""
      }) ===
Difficulté : ${s.session.difficulty}
Persona : ${s.session.persona_label}
Résultat : ${outcome}${evalSummary}

Transcript (tronqué) :
${truncate(transcript, 2200)}`;
    })
    .join("\n\n");

  const system = `Vous êtes consultant senior en prospection B2B téléphonique chez Noxias. On vous confie l'analyse des ${sessions.length} dernières sessions d'un commercial nommé ${commercialName} pour identifier ce qui revient SYSTÉMATIQUEMENT dans ses appels (défauts comme réussites) et orienter son entraînement.

# RÈGLES NON NÉGOCIABLES

1. Vouvoiement strict (jamais "tu / te / toi").
2. AUCUN tiret cadratin (— ou –). Utilisez points, deux-points, virgules.
3. AUCUN anglicisme. Si méthode anglophone (Gong, Voss, MEDDIC), entre parenthèses avec traduction française.
4. Mots SIMPLES, lisibles par un commercial junior. Pas de "verbatim qualifié", pas de "perte d'autorité conversationnelle". Si vous écrivez un mot que vous n'utiliseriez pas au déjeuner, refaites la phrase.
5. CITATIONS EXACTES obligatoires : les evidence_quote doivent être prises MOT POUR MOT dans les transcripts fournis. Pas d'invention.

# QUE VOUS DEVEZ PRODUIRE

Format JSON STRICT (sans markdown, sans texte avant/après) :

{
  "overall_diagnosis": "<2-3 phrases : où en est le commercial, son axe dominant à travailler, sa force principale s'il en a une. Mots simples.>",
  "recurring_defects": [
    {
      "name": "<Nom du défaut, max 6 mots. Ex : 'Pitch déroulé sans question'>",
      "occurrences": <nombre de sessions sur les ${sessions.length} où ce défaut apparaît, entier>,
      "evidence_quote": "<citation EXACTE du commercial extraite d'un transcript, max 25 mots>",
      "why_it_matters": "<1 phrase mots simples, pourquoi ce défaut casse l'appel>"
    },
    // 3 défauts au total, triés du plus fréquent au moins fréquent
  ],
  "action_axes": [
    {
      "title": "<Titre court max 8 mots, ex : 'Acquitter avant de répondre'>",
      "description": "<1-2 phrases mots simples, qui dit QUOI faire concrètement>",
      "example_phrase": "<phrase orale prête à dire, max 25 mots, que le commercial peut placer telle quelle>"
    },
    // 3 axes au total, triés par impact attendu
  ],
  "recommendation": {
    "mode": "<'full' | 'block' | 'embedded'>",
    "blockTarget": "<'brise_glace' | 'decouverte' | 'pitch' | 'objections' | 'closing' OU null si mode != 'block'>",
    "difficulty": "<'debutant' | 'intermediaire' | 'avance' | 'expert'>",
    "next_3_sessions": "<1 phrase qui dit EXACTEMENT quoi faire dans les 3 prochaines sessions, format directif vouvoyé, max 40 mots>"
  },
  "encouragement": "<1 phrase positive et concrète sur ce qui marche déjà, pour clôturer le rapport. Pas de flagornerie générique. Si rien de positif n'est observé, dites quel premier petit pas serait visible.>"
}

# RÈGLES D'ANALYSE

- Vous lisez les ${sessions.length} sessions D'AFFILÉE et cherchez les patterns RÉCURRENTS (présents sur 2 sessions ou plus).
- Un défaut qui n'apparaît qu'une fois ne mérite pas d'être listé : la valeur du scan c'est la régularité.
- Les recurring_defects.occurrences DOIT correspondre au nombre RÉEL de sessions où le pattern est observé (compte honnête, pas inventé).
- Si le commercial a obtenu plusieurs RDV : valoriser dans overall_diagnosis et encouragement.
- Si le commercial accepte régulièrement le mail / la doc sans RDV : faute n°1 à pointer, mode 'block' bloc 'closing' en recommandation.
- Si défauts variés sans dominante claire : recommandation mode 'embedded' (coach embarqué qui corrige en direct sur 4 axes).
- Si aucun défaut majeur récurrent : recommandation mode 'full' + difficulty supérieure pour challenger.

VOUS DÉVERROUILLEZ LA VALEUR DU SCAN : un manager paye pour avoir une vue claire de OÙ ENTRAÎNER. Soyez exigeant et précis.`;

  const user = `# COMMERCIAL ANALYSÉ : ${commercialName}

# ${sessions.length} DERNIÈRES SESSIONS COMPLÈTES

${sessionsBlock}

# VOTRE TÂCHE

Analysez ces ${sessions.length} sessions, identifiez les patterns récurrents, et produisez le JSON structuré attendu. Pas de blabla autour, juste le JSON.`;

  const response = await getAnthropic().messages.create(
    {
      model: SCAN_MODEL,
      max_tokens: 3500,
      temperature: 0,
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: user }],
    },
    { timeout: SCAN_TIMEOUT_MS },
  );

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Scan vide retourné par le cerveau IA.");
  }

  const cleaned = block.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let raw: CoachScanResult;
  try {
    raw = JSON.parse(cleaned) as CoachScanResult;
  } catch (err) {
    throw new Error(
      `Impossible de parser le scan IA : ${(err as Error).message}\n---\n${cleaned.slice(0, 500)}`,
    );
  }

  // Garde-fous minimal sur la structure attendue.
  if (!Array.isArray(raw.recurring_defects)) raw.recurring_defects = [];
  if (!Array.isArray(raw.action_axes)) raw.action_axes = [];
  if (!raw.recommendation) {
    raw.recommendation = {
      mode: "full",
      blockTarget: null,
      difficulty: "intermediaire",
      next_3_sessions:
        "Programmez 3 sessions en mode appel complet pour continuer à progresser.",
    };
  }
  return raw;
}
