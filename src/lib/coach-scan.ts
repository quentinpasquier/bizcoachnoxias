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

// Cartographie skill par catégorie : niveau atteint sur chacun des 5 blocs
// du cold call. Utilisée pour visualiser où le commercial est fort et où
// il est faible en un coup d'œil.
export interface SkillMapEntry {
  category: "accroche" | "decouverte" | "valeur" | "objections" | "closing";
  /** Note 0-10 estimée sur cette catégorie à partir des sessions analysées. */
  level: number;
  /** Étiquette qualitative associée (fort / moyen / faible). */
  qualifier: "fort" | "moyen" | "faible";
  /** 1 phrase en mots simples qui justifie le niveau (max 25 mots). */
  one_liner: string;
}

// Un moment précis dans une session où le commercial a fait perdre la
// dynamique de l'appel. Plus granulaire que "défaut récurrent" : un
// point perdu est un événement isolé qui a coûté cher.
export interface LostPoint {
  /** Contexte court : à quel moment de l'appel (max 12 mots). */
  moment: string;
  /** Citation EXACTE du commercial. */
  quote: string;
  /** Pourquoi ce moment fait perdre des points (1 phrase). */
  why: string;
  /** Combien de points environ sur 100 (estimation 1-15). */
  estimated_cost: number;
}

// Une situation où le commercial reste figé / la conversation n'avance
// plus / il ne sait pas quoi répondre. Différent d'un défaut : ici c'est
// l'inaction ou l'hésitation qui pose problème.
export interface Blocker {
  /** Type de situation où il bloque (max 10 mots). */
  situation: string;
  /** Exemple concret : citation prospect + réaction commercial. */
  example: string;
  /** Pourquoi il bloque dans cette situation, mots simples. */
  why_he_blocks: string;
  /** La piste de déblocage à essayer (1 phrase actionnable). */
  unlock_hint: string;
}

export interface CoachScanResult {
  /** Synthèse en 2-3 phrases de l'état actuel du commercial. */
  overall_diagnosis: string;
  /** Cartographie skill sur les 5 catégories de l'appel cold call. */
  skill_map: SkillMapEntry[];
  /** 3 défauts récurrents observés (triés du plus au moins fréquent). */
  recurring_defects: RecurringDefect[];
  /** 3 moments précis où il a perdu des points sur ses dernières sessions. */
  points_lost: LostPoint[];
  /** 3 situations dans lesquelles il bloque, ne sait pas quoi faire. */
  blockers: Blocker[];
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

  "skill_map": [
    {
      "category": "accroche",
      "level": <entier 0 à 10>,
      "qualifier": "<'fort' (>=7) | 'moyen' (4-6) | 'faible' (0-3)>",
      "one_liner": "<1 phrase mots simples qui justifie le niveau, max 25 mots>"
    },
    { "category": "decouverte", "level": 0-10, "qualifier": "...", "one_liner": "..." },
    { "category": "valeur",     "level": 0-10, "qualifier": "...", "one_liner": "..." },
    { "category": "objections", "level": 0-10, "qualifier": "...", "one_liner": "..." },
    { "category": "closing",    "level": 0-10, "qualifier": "...", "one_liner": "..." }
  ],

  "recurring_defects": [
    {
      "name": "<Nom du défaut, max 6 mots. Ex : 'Pitch déroulé sans question'>",
      "occurrences": <nombre de sessions sur les ${sessions.length} où ce défaut apparaît, entier>,
      "evidence_quote": "<citation EXACTE du commercial extraite d'un transcript, max 25 mots>",
      "why_it_matters": "<1 phrase mots simples, pourquoi ce défaut casse l'appel>"
    },
    // 3 défauts au total, triés du plus fréquent au moins fréquent
  ],

  "points_lost": [
    {
      "moment": "<À quel moment de l'appel, max 12 mots. Ex : 'Sur la question du ROI, en milieu d'appel'>",
      "quote": "<citation EXACTE du commercial qui a fait perdre des points, max 25 mots>",
      "why": "<1 phrase mots simples qui explique pourquoi ce moment fait perdre>",
      "estimated_cost": <entier 1-15, estimation des points perdus sur 100>
    },
    // 3 moments les plus coûteux observés
  ],

  "blockers": [
    {
      "situation": "<Type de situation où il bloque, max 10 mots. Ex : 'Quand le prospect demande un cas client précis'>",
      "example": "<Exemple concret : ce que le prospect a dit + ce que le commercial a répondu (ou n'a pas su répondre), max 50 mots>",
      "why_he_blocks": "<1 phrase mots simples, pourquoi il bloque dans cette situation>",
      "unlock_hint": "<1 phrase actionnable pour débloquer, mots simples>"
    },
    // 3 blocages observés (différents des défauts : ici l'inaction ou l'hésitation)
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

## Sur les patterns récurrents
- Vous lisez les ${sessions.length} sessions D'AFFILÉE et cherchez les patterns RÉCURRENTS (présents sur 2 sessions ou plus).
- Un défaut qui n'apparaît qu'une fois ne mérite pas d'être listé dans recurring_defects.
- Les recurring_defects.occurrences DOIT correspondre au nombre RÉEL de sessions où le pattern est observé (compte honnête).

## Sur la cartographie skill (skill_map)
- Vous notez les 5 catégories OBLIGATOIREMENT, MÊME quand vous estimez sur peu de signaux : un manager veut voir où le commercial est fort et où il est faible en un coup d'œil.
- La note 0-10 correspond au niveau OBSERVÉ sur les sessions analysées (pas un potentiel théorique).
- Cohérence : qualifier='fort' si level>=7, 'moyen' si 4<=level<=6, 'faible' si level<=3.
- Si la catégorie n'est pas observable (par exemple aucune objection émise par le prospect sur 5 sessions, donc on ne sait pas si le commercial sait gérer), mettez level=5 et one_liner précisant "Non observé sur ces sessions, niveau à confirmer".

## Sur les points perdus (points_lost)
- 3 moments PRÉCIS où le score baisse, pas une généralité. Chaque entrée DOIT contenir une citation exacte du commercial.
- estimated_cost réaliste : pour 5 sessions notées sur 100, un moment qui fait perdre 5-10 points est déjà majeur.
- Distinguez des recurring_defects : un point perdu est un événement précis qui a coûté, pas un pattern qui revient.

## Sur les blocages (blockers)
- 3 situations où le commercial reste figé, ne sait pas quoi dire, ou bafouille. C'est l'INACTION ou l'HÉSITATION, pas la mauvaise action.
- L'exemple DOIT montrer concrètement la situation (citation prospect + ce que le commercial a fait/pas fait).
- L'unlock_hint doit être ACTIONNABLE : pas "il faut être plus à l'aise" mais "Préparez un cas client chiffré à sortir d'office quand le prospect demande des références".

## Sur la recommandation
- Si le commercial accepte régulièrement le mail / la doc sans RDV : faute n°1 à pointer, mode 'block' bloc 'closing' en recommandation.
- Si défauts variés sans dominante claire : recommandation mode 'embedded' (coach embarqué qui corrige en direct sur 4 axes).
- Si aucun défaut majeur récurrent : recommandation mode 'full' + difficulty supérieure pour challenger.

## Encouragement
- Si le commercial a obtenu plusieurs RDV : le valoriser dans encouragement.
- Sinon, pointer la première amélioration objectivement observable possible.

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
  if (!Array.isArray(raw.skill_map)) raw.skill_map = [];
  if (!Array.isArray(raw.points_lost)) raw.points_lost = [];
  if (!Array.isArray(raw.blockers)) raw.blockers = [];
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
