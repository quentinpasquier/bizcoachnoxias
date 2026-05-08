import { getAnthropic, EVALUATOR_MODEL } from "./anthropic";
import { DIFFICULTY_CONFIG, getPersona } from "./personas";
import type { Difficulty, Evaluation } from "./supabase/types";

export interface EvaluationInput {
  difficulty: Difficulty;
  personaKey: string;
  productPitch: string | null;
  conversation: { role: "user" | "prospect"; content: string }[];
  endedBy: "user" | "prospect" | "timeout";
  appointmentSecured: boolean;
  hangupReason?: string;
}

const EVALUATION_SCHEMA = `{
  "overall_score": <int 0-100>,
  "axes": {
    "accroche": { "score": <int 0-20>, "comment": "<1 phrase concrète>" },
    "decouverte": { "score": <int 0-20>, "comment": "<1 phrase concrète>" },
    "objections": { "score": <int 0-20>, "comment": "<1 phrase concrète>" },
    "valeur": { "score": <int 0-20>, "comment": "<1 phrase concrète>" },
    "closing": { "score": <int 0-20>, "comment": "<1 phrase concrète>" }
  },
  "strengths": ["<3 forces concrètes, citation possible>", "...", "..."],
  "improvements": ["<3 axes d'amélioration concrets>", "...", "..."],
  "next_steps": ["<3 actions concrètes pour la prochaine session>", "...", "..."],
  "outcome_summary": "<2 à 3 phrases : ce qui s'est passé, pourquoi, et ce que ça dit du commercial>"
}`;

export async function evaluateSession(input: EvaluationInput): Promise<Evaluation> {
  const persona = getPersona(input.personaKey);
  const cfg = DIFFICULTY_CONFIG[input.difficulty];

  const transcript = input.conversation
    .map(
      (m) =>
        `${m.role === "user" ? "COMMERCIAL" : "PROSPECT"} : ${m.content}`,
    )
    .join("\n");

  const outcomeLine = input.appointmentSecured
    ? "RÉSULTAT : RDV obtenu."
    : input.endedBy === "prospect"
      ? `RÉSULTAT : Le prospect a raccroché. Raison annoncée : ${input.hangupReason ?? "non précisée"}.`
      : input.endedBy === "user"
        ? "RÉSULTAT : Le commercial a mis fin à l'appel."
        : "RÉSULTAT : Appel terminé par expiration.";

  const system = `Tu es coach commercial senior, ancien directeur des ventes. Tu évalues les commerciaux avec une rigueur exigeante mais bienveillante. Ton style : direct, concret, dirigeant à dirigeant. Pas de blabla, pas de mots anglais inutiles.

Tu vas analyser un appel de prospection téléphonique entre un commercial (en formation) et un prospect simulé.

Tu dois noter sur 5 axes (chacun /20) :
- ACCROCHE : pertinence des 30 premières secondes, accroche personnalisée vs générique
- DECOUVERTE : qualité des questions ouvertes, écoute active, capacité à creuser
- OBJECTIONS : gestion des résistances (acquittement → reformulation → réponse)
- VALEUR : capacité à transmettre un bénéfice concret, chiffré, lié au contexte du prospect
- CLOSING : assertivité dans la demande de RDV, proposition d'un créneau précis, gestion du « non »

Score global = somme des 5 axes (sur 100).

Tu réponds UNIQUEMENT avec un JSON valide, sans texte avant ni après, sans bloc markdown. Schéma exact :

${EVALUATION_SCHEMA}

Règles :
- Sois EXIGEANT : sur du Débutant, 60/100 c'est correct ; sur de l'Expert, 60/100 c'est déjà très bon.
- Cite des extraits de l'appel quand c'est pertinent (« Quand tu dis "...", tu... »).
- Tutoie le commercial dans tes commentaires (formation = proximité).
- Pas de langue de bois. Si c'était mauvais, dis-le. Si c'était excellent, dis-le aussi.`;

  const userMessage = `# CONTEXTE DE LA SESSION

Niveau : ${cfg.label}
Persona simulé : ${persona?.label ?? input.personaKey} (${persona?.role ?? "?"} chez ${persona?.company ?? "?"})
Pitch annoncé par le commercial : ${input.productPitch ?? "(non précisé)"}

${outcomeLine}

# TRANSCRIPT DE L'APPEL

${transcript}

# TA TÂCHE

Évalue l'appel selon le schéma JSON. Sois précis, concret, cite des passages. Réponds en JSON pur, sans markdown.`;

  const response = await getAnthropic().messages.create({
    model: EVALUATOR_MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Évaluation vide");
  }

  const raw = textBlock.text.trim();
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: Evaluation;
  try {
    parsed = JSON.parse(cleaned) as Evaluation;
  } catch (err) {
    throw new Error(
      `Impossible de parser l'évaluation Claude : ${(err as Error).message}\n---\n${cleaned}`,
    );
  }

  parsed.overall_score = Math.max(0, Math.min(100, Math.round(parsed.overall_score)));
  for (const axis of Object.values(parsed.axes)) {
    axis.score = Math.max(0, Math.min(20, Math.round(axis.score)));
  }

  return parsed;
}
