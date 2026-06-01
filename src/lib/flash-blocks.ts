// Mode "Coaching ciblé" / drill flash : chaque bloc du cold call devient un
// micro-exercice de 3-5 minutes avec phrase d'amorce tirée d'un pool, mission
// unique, 3 critères de réussite mesurables sur les deltas de l'évaluateur
// online, et un cadrage strict pour que le prospect reste DANS le bloc et
// n'avance pas le scénario complet.
//
// Le tirage de l'opener est fait côté serveur au moment du
// /api/sessions/start, stocké dans scenario_data.flash_meta, et reproduit
// tel quel sur la fiche flash (briefing), comme 1ʳᵉ réplique prospect
// déterministe en DB, et comme phrase épinglée pendant l'appel.

import type { BlockTarget } from "./supabase/types";
import type { DeltaCategory } from "./prospect-engine";

export interface FlashOpener {
  id: string;
  text: string;
  /** Catégorie d'objection (uniquement pour le bloc "objections"). Permet
   *  un sélecteur "Choisir la famille" UX bonus si on veut l'ajouter. */
  family?: string;
}

/** Un critère de réussite mesurable par les deltas que l'évaluateur online
 *  émet pendant l'appel. Sign "+" : valide si on atteint le seuil de cette
 *  catégorie positive. Sign "-" : valide tant que le seuil n'est PAS atteint
 *  sur cette catégorie négative (état "encore en règle"). */
export interface FlashCriterion {
  id: string;
  /** Libellé long pour la fiche flash et l'écran de résultat. */
  label: string;
  /** Libellé court pour les chips sticky pendant l'appel (~16 chars). */
  short: string;
  matcher: {
    sign: "+" | "-";
    category: DeltaCategory;
    /** Nombre d'occurrences pour valider/échouer. Défaut : 1. */
    threshold?: number;
  };
}

export interface FlashBlockMeta {
  short_label: string;
  /** 1 phrase impérative qui condense l'exercice. */
  mission: string;
  /** Contexte ultra-bref (2 lignes max) pour cadrer la situation de départ. */
  context_line: string;
  /** Exactement 3 critères mesurables, mêlant positif et négatif. */
  criteria: [FlashCriterion, FlashCriterion, FlashCriterion];
  /** Posture initiale du prospect pour le prompt système (remplace celle
   *  par défaut du persona). */
  prospect_posture: string;
  /** Directive forte qui interdit au prospect de glisser vers d'autres
   *  blocs (le commercial doit travailler CE bloc, pas tout l'appel). */
  prospect_constraint: string;
  /** Tours max du commercial avant que le bloc se conclue. */
  turn_limit: number;
}

// 5 phrases d'amorce pour brise-glace, découverte, pitch, closing.
// 12 phrases pour objections, typées par famille, parce que c'est la zone
// où la variété compte le plus pour drilller chaque type d'objection.
export const FLASH_OPENERS: Record<BlockTarget, FlashOpener[]> = {
  brise_glace: [
    { id: "bg-1", text: "Allô oui ?" },
    { id: "bg-2", text: "Allô ?" },
    { id: "bg-3", text: "Oui, j'écoute." },
    { id: "bg-4", text: "Oui c'est pour quoi ?" },
    { id: "bg-5", text: "Oui, faites vite, je suis entre deux rendez-vous." },
  ],
  decouverte: [
    {
      id: "dc-1",
      text: "Bon, j'ai cinq minutes. Vous vouliez me parler de quoi ?",
    },
    {
      id: "dc-2",
      text: "Allez-y, je vous écoute, mais soyez bref.",
    },
    {
      id: "dc-3",
      text: "OK, je veux bien comprendre, qu'est-ce qui vous amène ?",
    },
    {
      id: "dc-4",
      text: "Pourquoi vous m'appelez là maintenant ?",
    },
    {
      id: "dc-5",
      text: "Bon, je vous donne deux minutes. Pourquoi cet appel ?",
    },
  ],
  pitch: [
    {
      id: "pt-1",
      text: "Concrètement, qu'est-ce que vous proposez ?",
    },
    {
      id: "pt-2",
      text: "OK, et alors, ça nous apporte quoi à nous ?",
    },
    {
      id: "pt-3",
      text: "En quoi vous êtes différent des autres ?",
    },
    {
      id: "pt-4",
      text: "C'est quoi votre promesse en une phrase ?",
    },
    {
      id: "pt-5",
      text: "Et le ROI dans tout ça, vous le chiffrez comment ?",
    },
  ],
  objections: [
    {
      id: "ob-1",
      family: "deja_equipe",
      text: "Honnêtement, on a déjà un prestataire avec qui ça marche bien. Pourquoi je changerais ?",
    },
    {
      id: "ob-2",
      family: "pas_le_moment",
      text: "C'est pas la priorité de l'année là. Rappelez-moi dans six mois.",
    },
    {
      id: "ob-3",
      family: "prix",
      text: "Combien ça coûte votre truc ? Bon, écoutez, c'est trop cher pour nous.",
    },
    {
      id: "ob-4",
      family: "pas_bon_interlocuteur",
      text: "Ça concerne pas mon périmètre, c'est plutôt mon collègue qui s'occupe de ça.",
    },
    {
      id: "ob-5",
      family: "tentative_passee",
      text: "On a essayé un truc comme ça en 2023, ça n'a rien donné. Pourquoi ce serait différent ?",
    },
    {
      id: "ob-6",
      family: "roi_flou",
      text: "Sur le papier OK, mais concrètement, qu'est-ce que ça nous rapporte ?",
    },
    {
      id: "ob-7",
      family: "trop_petits",
      text: "Franchement, on est trop petits pour ce genre de solution.",
    },
    {
      id: "ob-8",
      family: "validation_interne",
      text: "Il faudrait que je convainque trois personnes en interne, ça prendra des mois.",
    },
    {
      id: "ob-9",
      family: "adoption_usage",
      text: "Mes équipes vont pas s'en servir. Elles ont déjà du mal avec les outils actuels.",
    },
    {
      id: "ob-10",
      family: "mefiance_vendor",
      text: "Vous êtes une jeune boîte. Dans deux ans vous serez peut-être plus là.",
    },
    {
      id: "ob-11",
      family: "lock_in",
      text: "On est sous contrat trois ans avec un autre fournisseur. Je peux rien faire.",
    },
    {
      id: "ob-12",
      family: "comparaison",
      text: "Et par rapport aux autres acteurs du marché, qu'est-ce que vous faites de mieux ?",
    },
  ],
  closing: [
    {
      id: "cl-1",
      text: "Bon, écoutez, envoyez-moi un mail avec votre proposition, je regarderai.",
    },
    {
      id: "cl-2",
      text: "Je vais en parler à mon équipe, je vous reviens.",
    },
    {
      id: "cl-3",
      text: "Rappelez-moi dans trois mois, on verra où on en est.",
    },
    {
      id: "cl-4",
      text: "Il faut que je voie ça avec ma direction avant de m'engager.",
    },
    {
      id: "cl-5",
      text: "Je dois réfléchir. Laissez-moi votre numéro, je vous rappelle.",
    },
  ],
};

// Mission + critères + cadrage prospect par bloc. Les critères mappent sur
// les DeltaCategory que l'évaluateur online émet déjà (cf prospect-engine.ts).
// 3 critères par bloc : généralement 1 positif obligatoire + 2 "garde-fous"
// négatifs (à ne pas franchir), pour transformer la session en mini-drill
// avec des objectifs mesurables et un PASS/FAIL clair en fin.
export const FLASH_BLOCKS: Record<BlockTarget, FlashBlockMeta> = {
  brise_glace: {
    short_label: "Brise-glace",
    mission:
      "Accroche en 15 secondes, obtiens l'autorisation de parler 2 minutes.",
    context_line:
      "Le prospect vient de décrocher. Tu as 15 secondes pour qu'il ne raccroche pas et ne te dise pas \"envoyez-moi un mail\".",
    criteria: [
      {
        id: "bg-c1",
        label: "Tu tiens face au filtre / au refus initial",
        short: "Tu tiens",
        matcher: { sign: "+", category: "relance-tenue" },
      },
      {
        id: "bg-c2",
        label: "Tu ne déroules pas ton pitch d'emblée",
        short: "Pas de pitch",
        matcher: { sign: "-", category: "pitch-deroule" },
      },
      {
        id: "bg-c3",
        label: "Pas de mots flous (\"accompagnement\", \"optimisation\")",
        short: "Zéro buzzword",
        matcher: { sign: "-", category: "baratin" },
      },
    ],
    prospect_posture:
      "Tu viens de décrocher, distrait, occupé. Tu ne sais pas qui appelle. Tu donnes 15 à 20 secondes max au commercial pour qu'il t'intéresse, sinon tu te désengages (renvoi mail, pas le bon moment, etc.).",
    prospect_constraint:
      "Tu joues UNIQUEMENT le décrochage et le brise-glace. Tu n'écoutes pas encore un pitch ni une découverte. Si le commercial saute en pitch produit ou en interrogatoire, tu le recadres sec : \"attendez, je sais même pas qui vous êtes\" ou \"vous voulez quoi exactement ?\". Pas d'objection métier ici, juste le filtre du décrochage.",
    turn_limit: 6,
  },
  decouverte: {
    short_label: "Découverte",
    mission:
      "Pose au moins 1 vraie question ouverte calibrée et reformule ce qu'il dit.",
    context_line:
      "Le commercial est passé. Tu lui donnes une fenêtre. Maintenant c'est à toi qu'il doit parler, pas à lui.",
    criteria: [
      {
        id: "dc-c1",
        label: "Au moins 1 vraie question ouverte ancrée sur son métier",
        short: "Question ouverte",
        matcher: { sign: "+", category: "bonne-question" },
      },
      {
        id: "dc-c2",
        label: "Tu reformules / fais l'effet miroir au moins une fois",
        short: "Reformulation",
        matcher: { sign: "+", category: "reformulation" },
      },
      {
        id: "dc-c3",
        label: "Pas de question fermée (oui/non) au mauvais moment",
        short: "Pas de oui/non",
        matcher: { sign: "-", category: "question-fermee" },
      },
    ],
    prospect_posture:
      "Tu as accepté de parler. Tu attends que le commercial te pose des questions sur ton métier. Tu ne déballes pas tes douleurs spontanément, il doit les déterrer. Tu réponds court (1 phrase) et tu valorises les questions qui touchent juste.",
    prospect_constraint:
      "Tu joues UNIQUEMENT la phase de découverte. Tu refuses d'entendre un pitch produit tant que le commercial n'a pas posé au moins 2 questions de fond. Si le commercial bascule en pitch ou en closing, tu coupes : \"attendez, vous me parliez de quoi déjà ?\". Tu ne sors pas d'objection majeure ici.",
    turn_limit: 8,
  },
  pitch: {
    short_label: "Pitch & valeur",
    mission:
      "Annonce 1 bénéfice clair, chiffré ou avec cas client, ancré sur ce que tu sais de lui.",
    context_line:
      "Le prospect a partagé son contexte. Il attend ta proposition de valeur, courte et adaptée à son cas, pas un argumentaire générique.",
    criteria: [
      {
        id: "pt-c1",
        label: "Au moins 1 chiffre concret ou cas client précis cité",
        short: "1 chiffre / cas",
        matcher: { sign: "+", category: "benefice-chiffre" },
      },
      {
        id: "pt-c2",
        label: "Tu ne déroules pas ta fiche commerciale (60+ mots d'un coup)",
        short: "Pas de récitation",
        matcher: { sign: "-", category: "pitch-deroule" },
      },
      {
        id: "pt-c3",
        label: "Pas de buzzword (\"synergie\", \"transformation digitale\")",
        short: "Zéro buzzword",
        matcher: { sign: "-", category: "baratin" },
      },
    ],
    prospect_posture:
      "Tu as déjà répondu à quelques questions du commercial. Il connaît grosso modo ton contexte. Tu attends maintenant sa proposition de valeur. Tu es exigeant sur la précision : un chiffre, un cas, ou un angle adapté à TON cas, pas un slogan générique.",
    prospect_constraint:
      "Tu joues UNIQUEMENT le moment du pitch. Tu ne sors PAS d'objection forte ici (c'est le bloc suivant), tu testes la qualité du pitch en lui-même. Si le commercial repart en découverte (\"et chez vous, comment ça se passe ?\"), tu coupes : \"on en a déjà parlé, allez-y, dites-moi ce que vous proposez concrètement\".",
    turn_limit: 6,
  },
  objections: {
    short_label: "Levée d'objections",
    mission:
      "Acquitte, creuse, reframe. Tiens 2 objections d'affilée sans capituler.",
    context_line:
      "Le prospect attaque dès la première seconde avec une objection franche. Tu dois la reconnaître, la creuser, et apporter un angle neuf.",
    criteria: [
      {
        id: "ob-c1",
        label: "Tu acquittes l'objection AVANT de répondre",
        short: "Acquittement",
        matcher: { sign: "+", category: "acquittement" },
      },
      {
        id: "ob-c2",
        label: "Pas de capitulation (\"je vous envoie un mail\")",
        short: "Tu ne lâches pas",
        matcher: { sign: "-", category: "capitulation" },
      },
      {
        id: "ob-c3",
        label: "Tu restes calme et professionnel, pas sec ni cassant",
        short: "Pas d'agressivité",
        matcher: { sign: "-", category: "agressivite" },
      },
    ],
    prospect_posture:
      "Tu as déjà entendu un pitch en gros (peu importe ce qu'il contenait précisément). Tu attaques dès ta première réplique avec une objection franche. Tu n'es PAS hostile, juste exigeant. Tu testes sa capacité à acquitter et à reframer, pas à te reconvaincre de zéro.",
    prospect_constraint:
      "Tu joues UNIQUEMENT la séquence d'objections. Si le commercial gère bien la 1ʳᵉ, tu en enchaînes une 2ème (même famille, ou une famille connexe puisée dans available_objections). Tu ne passes PAS au closing tant qu'il n'a pas tenu au moins 2 objections d'affilée. Si le commercial recommence à pitcher au lieu d'acquitter, tu ramènes sec sur l'objection : \"vous ne répondez pas à ce que je vous ai dit\".",
    turn_limit: 8,
  },
  closing: {
    short_label: "Closing",
    mission:
      "Verrouille un créneau précis (jour + heure) et le mail de confirmation.",
    context_line:
      "Le prospect est tiède. Il a écouté, il a objecté, il reconnaît qu'il y a peut-être quelque chose. Maintenant c'est à toi de proposer un créneau ferme.",
    criteria: [
      {
        id: "cl-c1",
        label: "Tu proposes un créneau précis (jour ET heure)",
        short: "Créneau J+H",
        matcher: { sign: "+", category: "creneau-precis" },
      },
      {
        id: "cl-c2",
        label: "Tu ne capitules pas sur \"envoyez-moi un mail\"",
        short: "Tu ne lâches pas",
        matcher: { sign: "-", category: "capitulation" },
      },
      {
        id: "cl-c3",
        label: "Tu maintiens ta demande malgré son flou",
        short: "Tu tiens",
        matcher: { sign: "+", category: "relance-tenue" },
      },
    ],
    prospect_posture:
      "Tu reconnais que le commercial a fait son travail (objections gérées, pitch correct). Tu es tiède : ni demandeur ni hostile. Tu valorises les créneaux précis (jour + heure) et le verrouillage par mail de confirmation. Tu essaies d'escamoter (\"envoyez-moi un mail\", \"rappelez-moi dans trois mois\") pour tester sa fermeté.",
    prospect_constraint:
      "Tu joues UNIQUEMENT le closing. Si le commercial recommence à pitcher ou à reposer des questions de découverte, tu coupes : \"on en a déjà parlé, on fait quoi maintenant concrètement ?\". Tu pénalises le flou (\"quand vous voulez\"), tu acceptes les créneaux précis qui passent l'épreuve.",
    turn_limit: 6,
  },
};

/** Tire une phrase d'amorce au hasard dans le pool du bloc demandé.
 *  Optionnellement exclut un id (pour éviter de retomber sur la même
 *  amorce que la session précédente côté UX "Refaire ce bloc"). */
export function pickFlashOpener(
  block: BlockTarget,
  excludeId?: string | null,
): FlashOpener {
  const pool = FLASH_OPENERS[block];
  const candidates = excludeId
    ? pool.filter((o) => o.id !== excludeId)
    : pool;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return picked ?? pool[0]!;
}

/** Évalue les 3 critères du bloc à partir des compteurs de deltas accumulés
 *  durant l'appel (positif et négatif séparément). Pour un critère "+", il
 *  passe quand le compteur atteint le seuil. Pour un critère "-", il passe
 *  tant que le compteur reste sous le seuil (état "encore en règle"). */
export function evaluateFlashCriteria(
  block: BlockTarget,
  positiveDeltas: Partial<Record<DeltaCategory, number>>,
  negativeDeltas: Partial<Record<DeltaCategory, number>>,
): { criterion: FlashCriterion; passed: boolean; count: number }[] {
  const meta = FLASH_BLOCKS[block];
  return meta.criteria.map((c) => {
    const threshold = c.matcher.threshold ?? 1;
    if (c.matcher.sign === "+") {
      const count = positiveDeltas[c.matcher.category] ?? 0;
      return { criterion: c, passed: count >= threshold, count };
    }
    const count = negativeDeltas[c.matcher.category] ?? 0;
    return { criterion: c, passed: count < threshold, count };
  });
}

/** Données stockées dans scenario_data.flash_meta côté DB pour reproduire
 *  l'amorce identique sur briefing / call / debrief. */
export interface FlashMeta {
  opener_id: string;
  opener_text: string;
  family?: string;
}
