import { getAnthropic, EVALUATOR_MODEL } from "./anthropic";
import { DIFFICULTY_CONFIG } from "./personas";
import type { Client, Difficulty, Evaluation, Scenario } from "./supabase/types";

export interface EvaluationInput {
  difficulty: Difficulty;
  scenario: Scenario;
  client: Client;
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

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}\n\n[... contenu tronqué ...]` : s;
}

export async function evaluateSession(input: EvaluationInput): Promise<Evaluation> {
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

  const docsBlock = input.client.synced_content
    ? `\n# RÉFÉRENTIEL DE PROSPECTION DU CLIENT (matrice + boîte à outils)
Ce que le commercial Noxias est censé maîtriser pour porter ${input.client.name}.

\`\`\`
${truncate(input.client.synced_content, 25000)}
\`\`\`
`
    : "";

  const system = `Tu es coach commercial senior chez Noxias, agence de prospection externalisée. Tu évalues les commerciaux Noxias avec rigueur exigeante mais bienveillante. Style : direct, concret, dirigeant à dirigeant. Pas de blabla, pas d'anglicismes inutiles.

Tu analyses un appel de prospection téléphonique entre un commercial Noxias (en formation) et un prospect simulé. Le commercial appelle au nom d'un client de Noxias et porte son pitch.

Tu notes sur 5 axes (chacun /20) :
- ACCROCHE : pertinence des 30 premières secondes, accroche personnalisée, conformité au script référencé dans la boîte à outils
- DECOUVERTE : qualité des questions ouvertes, écoute active, capacité à creuser les KPI/pains du référentiel
- OBJECTIONS : gestion des résistances (acquittement → reformulation → réponse), particulièrement face aux objections référencées
- VALEUR : capacité à transmettre la value proposition de manière concrète et liée au contexte du prospect
- CLOSING : assertivité dans la demande de RDV, créneau précis, gestion du « non »

Score global = somme des 5 axes (sur 100).

Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant/après. Schéma exact :

${EVALUATION_SCHEMA}

Règles :
- Sois EXIGEANT : sur Débutant, 60/100 c'est correct ; sur Expert, 60/100 c'est déjà très bon.
- Cite des extraits de l'appel (« Quand tu dis "...", tu... »).
- Réfère-toi aux concepts du référentiel client.
- Tutoie le commercial dans tes commentaires.
- Pas de langue de bois.`;

  const userMessage = `# CONTEXTE DE LA SESSION

Niveau : ${cfg.label}
Persona joué (scénario généré) :
- Nom : ${input.scenario.persona_name} (${input.scenario.persona_role})
- Entreprise : ${input.scenario.company_name}
- Contexte : ${input.scenario.company_context}
- Situation : ${input.scenario.current_situation}
- Pains cachés : ${input.scenario.hidden_pain_points.join(" ; ")}
- KPIs surveillés : ${input.scenario.kpis_to_probe.join(" ; ")}
- Critères de décision RDV : ${input.scenario.decision_criteria}

Client Noxias : ${input.client.name}${input.client.sector ? ` (${input.client.sector})` : ""}
Pitch que le commercial était censé porter : ${input.client.product_pitch}
${input.client.value_proposition ? `Value prop : ${input.client.value_proposition}` : ""}

${docsBlock}

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
