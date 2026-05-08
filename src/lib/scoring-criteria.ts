// Grille de scoring d'argumentation Noxias.
// 20 critères binaires (passed = 0 ou 1) regroupés en 5 catégories.
// Score brut /20 → converti en /100 (×5) pour l'affichage.

export interface ScoringCriterion {
  id: string;
  label: string;
  description: string;
}

export interface ScoringCategory {
  key: CategoryKey;
  label: string;
  criteria: ScoringCriterion[];
}

export type CategoryKey =
  | "accroche"
  | "decouverte"
  | "valeur"
  | "objections"
  | "closing";

export const SCORING_CATEGORIES: ScoringCategory[] = [
  {
    key: "accroche",
    label: "Accroche",
    criteria: [
      {
        id: "accroche_presentation",
        label: "Présentation claire",
        description: "Nom + société + raison de l'appel énoncés en moins de 10 secondes.",
      },
      {
        id: "accroche_personnalisation",
        label: "Personnalisation",
        description:
          "Référence concrète au prospect, à son secteur ou à son entreprise (pas un pitch générique).",
      },
      {
        id: "accroche_pas_molle",
        label: "Pas d'amorce molle",
        description:
          "Évite les formules « je me permets de vous appeler », « j'espère ne pas vous déranger », etc.",
      },
      {
        id: "accroche_permission",
        label: "Permission d'appel",
        description:
          "Demande explicite du temps du prospect (« je vous prends 30 secondes ? »).",
      },
      {
        id: "accroche_question_ouverte",
        label: "Question d'amorce ouverte",
        description:
          "Engage le prospect avec une question (pas un monologue de présentation).",
      },
    ],
  },
  {
    key: "decouverte",
    label: "Découverte",
    criteria: [
      {
        id: "decouverte_situation",
        label: "Question sur la situation actuelle",
        description:
          "Cherche à comprendre le contexte avant de proposer (« comment vous faites pour... ? »).",
      },
      {
        id: "decouverte_kpi",
        label: "Question sur les KPI / chiffres",
        description:
          "Cherche à quantifier (coût d'acquisition, taux, volumes, délais, panier moyen).",
      },
      {
        id: "decouverte_pain",
        label: "Question sur le pain",
        description:
          "Laisse émerger la douleur du prospect sans la souffler à sa place.",
      },
      {
        id: "decouverte_ecoute",
        label: "Écoute active",
        description:
          "Reformule ou laisse un silence après une question (au lieu d'enchaîner).",
      },
    ],
  },
  {
    key: "valeur",
    label: "Pitch & Valeur",
    criteria: [
      {
        id: "valeur_value_prop",
        label: "Value prop claire",
        description: "Bénéfice formulé en une phrase concrète, sans jargon.",
      },
      {
        id: "valeur_chiffre",
        label: "Bénéfice chiffré",
        description:
          "Mentionne un chiffre, un pourcentage ou un délai (« divise par 2 », « +30 % », « en 4 mois »).",
      },
      {
        id: "valeur_preuve_sociale",
        label: "Preuve sociale",
        description:
          "Cite un cas client comparable, une référence ou un benchmark.",
      },
      {
        id: "valeur_adaptation",
        label: "Pitch adapté",
        description:
          "Réutilise une info révélée par le prospect dans sa réponse, pas un pitch déroulé à l'identique.",
      },
    ],
  },
  {
    key: "objections",
    label: "Objections",
    criteria: [
      {
        id: "objections_acquittement",
        label: "Acquittement",
        description:
          "Reconnaît l'objection avant de répondre (« je comprends », « c'est légitime »).",
      },
      {
        id: "objections_reformulation",
        label: "Reformulation",
        description:
          "Reformule l'objection pour vérifier qu'il l'a bien comprise.",
      },
      {
        id: "objections_angle_neuf",
        label: "Angle neuf",
        description:
          "Ne répète pas le pitch. apporte un argument ou un angle nouveau.",
      },
      {
        id: "objections_tient_refus",
        label: "Tient face au refus",
        description:
          "Relance avec finesse au lieu de capituler au premier « non ».",
      },
    ],
  },
  {
    key: "closing",
    label: "Closing",
    criteria: [
      {
        id: "closing_demande",
        label: "Demande explicite du RDV",
        description: "Formulation claire et directe de la demande de RDV.",
      },
      {
        id: "closing_creneau",
        label: "Créneau précis proposé",
        description:
          "Propose une date et une heure précise (pas « quand ça vous arrange »).",
      },
      {
        id: "closing_recap",
        label: "Récap de la valeur du RDV",
        description:
          "Rappelle ce que le prospect aura à gagner en venant au RDV.",
      },
    ],
  },
];

export const TOTAL_CRITERIA = SCORING_CATEGORIES.reduce(
  (acc, cat) => acc + cat.criteria.length,
  0,
);

export function getAllCriteria(): ScoringCriterion[] {
  return SCORING_CATEGORIES.flatMap((c) => c.criteria);
}

export function getCategoryByKey(key: CategoryKey): ScoringCategory | undefined {
  return SCORING_CATEGORIES.find((c) => c.key === key);
}
