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

// Grille orientée COLD CALL B2B TÉLÉPHONIQUE : appels courts (3-6 min),
// pas une démo. L'objectif est de décrocher un RDV, pas de vendre au tel.
export const SCORING_CATEGORIES: ScoringCategory[] = [
  {
    key: "accroche",
    label: "Accroche",
    criteria: [
      {
        id: "accroche_presentation",
        label: "Présentation flash",
        description:
          "Annonce en moins de 15 secondes : prénom + société + raison de l'appel.",
      },
      {
        id: "accroche_personnalisation",
        label: "Personnalisation",
        description:
          "Référence au prospect, son secteur, sa boîte ou un signal récent. Pas un pitch générique.",
      },
      {
        id: "accroche_pas_molle",
        label: "Pas d'amorce molle",
        description:
          "Évite « je me permets de vous appeler », « j'espère que je ne dérange pas », « si vous avez 2 minutes ».",
      },
      {
        id: "accroche_permission",
        label: "Demande de temps explicite",
        description:
          "Cadre l'appel : « je vous vole 30 secondes », « 1 minute et je vous laisse ».",
      },
      {
        id: "accroche_decideur",
        label: "Vérifie l'interlocuteur",
        description:
          "S'assure de parler au bon décideur (« c'est bien vous qui gérez X ? »).",
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
          "Cherche à comprendre comment le prospect fait aujourd'hui (« vous gérez ça en interne ou en externe ? »).",
      },
      {
        id: "decouverte_kpi",
        label: "Question chiffre / KPI",
        description:
          "Cherche un volume, un taux, un coût, un délai pour ancrer la valeur sur du concret.",
      },
      {
        id: "decouverte_pain",
        label: "Fait émerger une douleur",
        description:
          "Laisse le prospect verbaliser un problème, sans le souffler à sa place.",
      },
      {
        id: "decouverte_ecoute",
        label: "Écoute active",
        description:
          "Reformule, rebondit sur une info donnée, laisse parler le prospect au lieu d'enchaîner.",
      },
    ],
  },
  {
    key: "valeur",
    label: "Pitch & valeur",
    criteria: [
      {
        id: "valeur_value_prop",
        label: "Bénéfice clair en 1 phrase",
        description:
          "Formule la promesse en une phrase concrète, sans jargon. Le prospect comprend ce qu'il gagne.",
      },
      {
        id: "valeur_chiffre",
        label: "Bénéfice chiffré ou cas client",
        description:
          "Cite un %, un délai, un montant, OU une référence comparable au prospect.",
      },
      {
        id: "valeur_adaptation",
        label: "Pitch adapté au prospect",
        description:
          "Reprend explicitement une info que le prospect a donnée. Le pitch n'est pas déroulé à l'identique.",
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
        label: "Creuse l'objection",
        description:
          "Reformule ou pose une question pour comprendre la vraie nature de l'objection.",
      },
      {
        id: "objections_pas_le_temps",
        label: "Gère « pas le temps » / « pas intéressé »",
        description:
          "Ne capitule pas au premier refus. Propose une reformulation ou un take-away (rappel plus tard).",
      },
      {
        id: "objections_angle_neuf",
        label: "Apporte un angle neuf",
        description:
          "Répond avec un argument différent du pitch initial, pas en répétant.",
      },
      {
        id: "objections_tient_refus",
        label: "Tient sur 2 objections",
        description:
          "Encaisse 2 objections d'affilée sans s'effondrer ni devenir agressif.",
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
        description:
          "Énonce clairement la demande (« ce que je vous propose, c'est un échange de 20 min »).",
      },
      {
        id: "closing_creneau",
        label: "Créneau précis proposé",
        description:
          "Propose 1 ou 2 créneaux concrets avec jour + heure (pas « quand vous voulez »).",
      },
      {
        id: "closing_verrouillage",
        label: "Verrouille / take-away",
        description:
          "Verrouille le RDV verbalement obtenu par un mail de CONFIRMATION calendrier (invitation Outlook/Google sur le créneau accepté à l'oral), OU, en cas de refus, propose un rappel daté avec jour + heure précis. ATTENTION : accepter d'« envoyer une plaquette / de la doc / des infos par mail / une présentation » SANS avoir d'abord obtenu un oui verbal sur un créneau n'est PAS un verrouillage, c'est une capitulation déguisée — critère à 0 dans ce cas.",
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
