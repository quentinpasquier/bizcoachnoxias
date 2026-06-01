import { getAnthropic } from "./anthropic";
import type { BlockTarget, Client, Scenario } from "./supabase/types";

// Coach embarqué (Mode 2) : évaluateur online Haiku qui décide si une
// réponse du commercial fait avancer la conversation. Si non, on bloque
// le pipeline AVANT que la réponse n'arrive au prospect et le coach
// explique au commercial ce qui ne va pas.

export interface CoachCheckInput {
  client: Client;
  scenario: Scenario;
  blockTarget?: BlockTarget | null;
  history: { role: "user" | "prospect"; content: string }[];
  /** La dernière réplique du commercial qu'on est en train d'évaluer. */
  userText: string;
  /** Nombre de blocages déjà subis sur CETTE réplique. À 3, force_unlock. */
  attemptsOnThisReply: number;
}

export type CoachVerdict = "pass" | "block" | "force_unlock";

export interface CoachCheckResult {
  verdict: CoachVerdict;
  scores: {
    precision: number;
    ecoute: number;
    pertinence: number;
    professionnalisme: number;
  };
  /** Phrase courte (≤25 mots) à lire au commercial. Vide si pass. */
  reason: string;
  /**
   * Formulation modèle prête à dire. Affichée + lue si force_unlock,
   * affichée seulement si block (le commercial reformule lui-même).
   */
  suggestion: string;
}

const MAX_ATTEMPTS = 3;

const COACH_MODEL = "claude-haiku-4-5-20251001";

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}\n[…]` : s;
}

export async function evaluateCoachCheck(
  input: CoachCheckInput,
): Promise<CoachCheckResult> {
  // Garde : le tout premier tour du commercial passe TOUJOURS sans
  // blocage. C'est la phrase d'accroche, juste après le décrochage
  // prospect — la bloquer d'entrée frustre le commercial avant même
  // que l'échange ait pris. Si la 1ʳᵉ phrase est faible, on la laissera
  // passer et le coach interviendra sur les tours suivants quand le
  // contexte de l'appel sera installé.
  const priorUserTurns = input.history.filter((t) => t.role === "user").length;
  if (priorUserTurns === 0) {
    return {
      verdict: "pass",
      scores: { precision: 5, ecoute: 5, pertinence: 5, professionnalisme: 5 },
      reason: "",
      suggestion: "",
    };
  }

  // Force-unlock automatique : après MAX_ATTEMPTS blocages sur la même
  // réplique, on débloque le pipeline pour ne pas frustrer le commercial,
  // ET on lui donne la formulation modèle qui sera ensuite affichée
  // comme référence dans l'encart gold (plus de TTS).
  if (input.attemptsOnThisReply >= MAX_ATTEMPTS) {
    // On laisse quand même Haiku produire une suggestion (la formulation
    // modèle exemplaire) mais on force le verdict.
    const forced = await callHaiku(input, true);
    return { ...forced, verdict: "force_unlock" };
  }

  return callHaiku(input, false);
}

async function callHaiku(
  input: CoachCheckInput,
  forceUnlockMode: boolean,
): Promise<CoachCheckResult> {
  const lastProspectMessage =
    [...input.history].reverse().find((t) => t.role === "prospect")?.content ??
    "(début de l'appel)";

  const conversationExtract = input.history
    .slice(-6)
    .map(
      (t) =>
        `${t.role === "user" ? "COMMERCIAL" : "PROSPECT"}: ${truncate(t.content, 250)}`,
    )
    .join("\n");

  const blockContext = input.blockTarget
    ? `\nBloc travaillé : ${input.blockTarget} (mode coaching ciblé)\n`
    : "";

  const system = `Vous êtes coach commercial pédagogique embarqué dans un simulateur d'appel à froid B2B. Votre rôle : évaluer SI la réponse du commercial fait avancer la conversation avec son prospect.

Vous notez 4 axes de 0 à 10 :
1. PRÉCISION : la réponse est-elle concrète, sans flou ni jargon vide (pas de "optimisation", "synergie", "transformation digitale" sans contenu) ?
2. ÉCOUTE : rebondit-elle sur ce que le prospect a RÉELLEMENT dit dans son dernier message ?
3. PERTINENCE : la réponse est-elle adaptée à la situation actuelle de l'appel (objection vs découverte vs closing) ?
4. PROFESSIONNALISME : vouvoiement strict, pas de baratin, ton posé d'adulte au travail ?

RÈGLE DE BLOCAGE : verdict = "block" si :
- N'IMPORTE QUEL des 4 scores est strictement inférieur à 6
- OU une faute grave est présente :
  • Capitulation : "je vous envoie un mail / une plaquette / de la doc" sans contre-proposition de RDV verbal
  • Baratin (seuil ÉLEVÉ — uniquement quand l'ensemble est creux) : la réponse repose dominamment sur des mots vides juxtaposés ("synergie", "optimisation", "expertise reconnue", "approche disruptive", "accompagnement sur mesure", "transformation digitale") SANS aucune concretion à côté. UN SEUL mot abstrait dans une phrase qui contient PAR AILLEURS un chiffre, un cas client, un exemple opérationnel, ou une question ancrée sur le métier du prospect ne déclenche PAS Baratin — on ne bloque que si TOUT est creux. En cas de doute, tu laisses passer.
  • Esquive : ne répond PAS à la question/objection que le prospect vient de poser
  • Tutoiement du prospect ("tu", "te", "toi")
  • Réponse trop courte (< 5 mots) qui n'apporte rien

Si tout est OK : verdict = "pass". On laisse le commercial enchaîner et le prospect répondre.

# SI BLOCAGE : reason + suggestion

- reason : phrase courte (max 25 mots), vouvoyée, qui dit EN MOTS SIMPLES ce qui ne va pas. Ton calme, pédagogique, pas méprisant. Exemple : "Vous utilisez le mot 'optimisation' sans le rendre concret. Le prospect ne sait pas ce que ça change pour lui."
- suggestion : formulation modèle (max 30 mots) que le commercial AURAIT PU dire à la place. Phrase orale prête à reprendre. Exemple : "Vous me dites que vos commerciaux perdent du temps en RDV. C'est combien de minutes par visite en moyenne ?"

${
  forceUnlockMode
    ? "\nIMPORTANT : c'est la 3e fois que le commercial est bloqué sur cette réponse. Votre suggestion sera lue à voix haute en intégralité comme formulation modèle, alors soignez-la particulièrement et donnez une phrase vraiment exemplaire et utilisable telle quelle.\n"
    : ""
}

# FORMAT DE RÉPONSE (JSON UNIQUEMENT, sans markdown, sans texte avant/après)

{
  "verdict": "pass" | "block",
  "scores": {
    "precision": 0-10,
    "ecoute": 0-10,
    "pertinence": 0-10,
    "professionnalisme": 0-10
  },
  "reason": "Vide si pass, sinon phrase courte calme et claire.",
  "suggestion": "Vide si pass, sinon formulation modèle prête à dire."
}`;

  const user = `# CONTEXTE DE L'APPEL

Client porté : ${input.client.name}${input.client.sector ? ` (${input.client.sector})` : ""}
Pitch attendu : ${input.client.product_pitch}
Persona joué : ${input.scenario.persona_name} (${input.scenario.persona_role}) chez ${input.scenario.company_name}
Douleurs cachées du prospect : ${input.scenario.hidden_pain_points.join(" ; ")}
${blockContext}
# DERNIERS ÉCHANGES (max 6)

${conversationExtract || "(premier tour)"}

# DERNIER MESSAGE DU PROSPECT (à reconnaître / auquel répondre)

"${truncate(lastProspectMessage, 400)}"

# RÉPONSE DU COMMERCIAL À ÉVALUER

"${truncate(input.userText, 600)}"

# VOTRE TÂCHE

Analysez la réponse du commercial selon les 4 axes. Répondez en JSON pur.`;

  const response = await getAnthropic().messages.create(
    {
      model: COACH_MODEL,
      max_tokens: 500,
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
    { timeout: 12000 },
  );

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    // Sécurité : si Haiku échoue, on laisse passer pour ne pas casser
    // l'appel. Le commercial ne sera juste pas bloqué cette fois.
    return {
      verdict: "pass",
      scores: { precision: 5, ecoute: 5, pertinence: 5, professionnalisme: 5 },
      reason: "",
      suggestion: "",
    };
  }

  const cleaned = block.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  type Raw = {
    verdict?: string;
    scores?: Partial<Record<"precision" | "ecoute" | "pertinence" | "professionnalisme", number>>;
    reason?: string;
    suggestion?: string;
  };

  let raw: Raw;
  try {
    raw = JSON.parse(cleaned) as Raw;
  } catch {
    // Idem : on évite de casser l'appel, on laisse passer.
    return {
      verdict: "pass",
      scores: { precision: 5, ecoute: 5, pertinence: 5, professionnalisme: 5 },
      reason: "",
      suggestion: "",
    };
  }

  const verdict: CoachVerdict = raw.verdict === "block" ? "block" : "pass";
  const scores = {
    precision: clampScore(raw.scores?.precision),
    ecoute: clampScore(raw.scores?.ecoute),
    pertinence: clampScore(raw.scores?.pertinence),
    professionnalisme: clampScore(raw.scores?.professionnalisme),
  };

  return {
    verdict,
    scores,
    reason: typeof raw.reason === "string" ? raw.reason.trim() : "",
    suggestion: typeof raw.suggestion === "string" ? raw.suggestion.trim() : "",
  };
}

function clampScore(n: unknown): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 5;
  return Math.max(0, Math.min(10, Math.round(n)));
}

export { MAX_ATTEMPTS };
