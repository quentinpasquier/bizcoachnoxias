import type {
  BlockTarget,
  MessageRow,
  SessionRow,
  TrainingMode,
} from "./supabase/types";

// Diagnostic agrégé par commercial : analyse les delta_category stockés
// dans messages.metadata depuis la PR sur les deltas typés, identifie
// les patterns récurrents (top 3 défauts) et recommande un mode +
// bloc d'entraînement adapté. Permet au manager de dire à son équipe
// "concentre-toi sur ÇA cette semaine" plutôt que "fais des sessions".

// 12 catégories possibles, 6 positives + 6 négatives, qui correspondent
// aux DELTA:+/- émis par le persona pendant l'appel.
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

const NEGATIVE_CATEGORIES = new Set<DeltaCategory>([
  "pitch-deroule",
  "question-fermee",
  "capitulation",
  "baratin",
  "esquive",
  "agressivite",
]);

const CATEGORY_LABEL: Record<DeltaCategory, string> = {
  "bonne-question": "Bonnes questions",
  acquittement: "Acquittements",
  "benefice-chiffre": "Bénéfices chiffrés",
  reformulation: "Reformulations",
  "creneau-precis": "Créneaux précis",
  "relance-tenue": "Relances tenues",
  "pitch-deroule": "Pitch déroulé",
  "question-fermee": "Questions fermées",
  capitulation: "Capitulations (mail)",
  baratin: "Baratin / mots flous",
  esquive: "Esquives de question",
  agressivite: "Agressivité / coupures",
};

// Mapping faute dominante → bloc de Coaching ciblé qui adresse cette
// faute. Permet de recommander précisément où s'entraîner.
const CATEGORY_TO_BLOCK: Record<DeltaCategory, BlockTarget | null> = {
  // Positifs : pas de recommandation, c'est déjà bien
  "bonne-question": null,
  acquittement: null,
  "benefice-chiffre": null,
  reformulation: null,
  "creneau-precis": null,
  "relance-tenue": null,
  // Négatifs : on cible le bloc qui adresse la faute
  "pitch-deroule": "pitch",
  "question-fermee": "decouverte",
  capitulation: "closing",
  baratin: "pitch",
  esquive: "objections",
  agressivite: "objections",
};

const BLOCK_LABEL: Record<BlockTarget, string> = {
  brise_glace: "Brise-glace",
  decouverte: "Découverte",
  pitch: "Pitch & valeur",
  objections: "Levée d'objections",
  closing: "Closing",
};

export interface CommercialDiagnostic {
  /** True si on a au moins 3 sessions complétées pour faire un diag fiable. */
  hasEnoughData: boolean;
  /** Total de toutes les deltas négatives observées sur les sessions. */
  totalNegative: number;
  /** Top défauts triés par occurrences (max 3). */
  topDefects: Array<{
    category: DeltaCategory;
    label: string;
    count: number;
    /** Pourcentage du total des défauts. */
    share: number;
  }>;
  /** Recommandation principale : mode + bloc à travailler. */
  recommendation: {
    mode: TrainingMode;
    blockTarget: BlockTarget | null;
    blockLabel: string | null;
    /** Phrase courte à afficher au manager. */
    headline: string;
    /** Pourquoi : top défaut + nombre. */
    reason: string;
  } | null;
}

/**
 * Analyse l'historique d'un commercial pour identifier ses patterns
 * de défauts et recommander un entraînement ciblé.
 *
 * @param sessions  Ses sessions complétées récentes (10-30 typiquement).
 * @param messages  Les messages prospect dont metadata.delta_category est
 *                  exploitable. Filtre côté DB par session_id IN
 *                  (sessions.id) + role='prospect'.
 */
export function diagnoseCommercial(
  sessions: SessionRow[],
  messages: Pick<MessageRow, "metadata">[],
): CommercialDiagnostic {
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  if (completedCount < 3) {
    return {
      hasEnoughData: false,
      totalNegative: 0,
      topDefects: [],
      recommendation: null,
    };
  }

  // Compte les occurrences de chaque catégorie négative dans les
  // metadata des messages prospect.
  const counts: Partial<Record<DeltaCategory, number>> = {};
  for (const m of messages) {
    const cat = (m.metadata as { delta_category?: string } | null)
      ?.delta_category;
    if (!cat) continue;
    if (!NEGATIVE_CATEGORIES.has(cat as DeltaCategory)) continue;
    const key = cat as DeltaCategory;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const totalNegative = Object.values(counts).reduce(
    (acc, n) => acc + (n ?? 0),
    0,
  );

  if (totalNegative === 0) {
    // Le commercial cumule des sessions sans accroc majeur — on
    // recommande de monter en difficulté plutôt que de cibler un bloc.
    return {
      hasEnoughData: true,
      totalNegative: 0,
      topDefects: [],
      recommendation: {
        mode: "full",
        blockTarget: null,
        blockLabel: null,
        headline: "Monte d'un niveau de difficulté",
        reason:
          "Aucun défaut majeur détecté sur les dernières sessions. Le commercial est prêt à se challenger.",
      },
    };
  }

  // Top 3 défauts par occurrences.
  const topDefects = (Object.entries(counts) as [DeltaCategory, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, count]) => ({
      category,
      label: CATEGORY_LABEL[category],
      count,
      share: Math.round((count / totalNegative) * 100),
    }));

  // Recommandation : on cible le bloc associé au défaut numéro 1.
  const topDefect = topDefects[0]!;
  const blockTarget = CATEGORY_TO_BLOCK[topDefect.category];
  const blockLabel = blockTarget ? BLOCK_LABEL[blockTarget] : null;

  const recommendation = blockTarget
    ? {
        mode: "block" as const,
        blockTarget,
        blockLabel,
        headline: `Coaching ciblé sur "${blockLabel}"`,
        reason: `${topDefect.count} occurrence${topDefect.count > 1 ? "s" : ""} de "${topDefect.label.toLowerCase()}" sur les sessions récentes.`,
      }
    : {
        mode: "embedded" as const,
        blockTarget: null,
        blockLabel: null,
        headline: "Coaching embarqué",
        reason: `${topDefect.count} occurrence${topDefect.count > 1 ? "s" : ""} de "${topDefect.label.toLowerCase()}" non rattaché à un bloc précis. Le coach embarqué corrigera en direct.`,
      };

  return {
    hasEnoughData: true,
    totalNegative,
    topDefects,
    recommendation,
  };
}
