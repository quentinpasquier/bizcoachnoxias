import { getAnthropic, EVALUATOR_MODEL } from "./anthropic";
import { DIFFICULTY_CONFIG } from "./personas";
import {
  SCORING_CATEGORIES,
  TOTAL_CRITERIA,
  getCategoryByKey,
} from "./scoring-criteria";
import type {
  CategoryKey,
  CategoryResult,
  Client,
  Difficulty,
  Evaluation,
  Scenario,
} from "./supabase/types";

export interface EvaluationInput {
  difficulty: Difficulty;
  scenario: Scenario;
  client: Client;
  conversation: { role: "user" | "prospect"; content: string }[];
  endedBy: "user" | "prospect" | "timeout";
  appointmentSecured: boolean;
  hangupReason?: string;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}\n\n[... contenu tronqué ...]` : s;
}

interface RawCriterionResult {
  id: string;
  passed: boolean;
  comment: string;
}

interface RawEvaluatorResponse {
  criteria: RawCriterionResult[];
  strengths: string[];
  improvements: string[];
  next_steps: string[];
  outcome_summary: string;
}

const RESPONSE_SCHEMA = `{
  "criteria": [
    { "id": "<id du critère>", "passed": <true|false>, "comment": "<1 phrase courte qui justifie le score, citation possible>" }
    // ... une entrée par critère, dans n'importe quel ordre
  ],
  "strengths": ["<3 forces concrètes>", "...", "..."],
  "improvements": ["<3 axes d'amélioration concrets>", "...", "..."],
  "next_steps": ["<3 actions concrètes pour la prochaine session>", "...", "..."],
  "outcome_summary": "<2 à 3 phrases : ce qui s'est passé, pourquoi, ce que ça dit du commercial>"
}`;

function buildCriteriaListForPrompt(): string {
  return SCORING_CATEGORIES.map((cat) => {
    const lines = cat.criteria.map(
      (c) => `  - id: "${c.id}" — ${c.label} : ${c.description}`,
    );
    return `Catégorie ${cat.label.toUpperCase()} (${cat.criteria.length} critères) :\n${lines.join(
      "\n",
    )}`;
  }).join("\n\n");
}

export async function evaluateSession(input: EvaluationInput): Promise<Evaluation> {
  const cfg = DIFFICULTY_CONFIG[input.difficulty];

  const transcript = input.conversation
    .map((m) => `${m.role === "user" ? "COMMERCIAL" : "PROSPECT"} : ${m.content}`)
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
\`\`\`
${truncate(input.client.synced_content, 20000)}
\`\`\`
`
    : "";

  const criteriaList = buildCriteriaListForPrompt();

  const system = `Tu es coach commercial senior chez Noxias, agence de prospection externalisée. Tu évalues les commerciaux Noxias avec rigueur exigeante mais bienveillante. Style : direct, concret, dirigeant à dirigeant. Pas de blabla, pas d'anglicismes.

Tu analyses un appel de prospection téléphonique. Tu dois noter le commercial sur ${TOTAL_CRITERIA} critères BINAIRES (passed = true ou false). Pour chaque critère, tu juges si le commercial l'a validé pendant l'appel. Sois EXIGEANT : un critère n'est validé que s'il est clairement observable dans le transcript.

# CRITÈRES À ÉVALUER (chacun = 0 ou 1)

${criteriaList}

# FORMAT DE RÉPONSE

Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant/après. Schéma EXACT :

${RESPONSE_SCHEMA}

# RÈGLES
- TOUJOURS inclure les ${TOTAL_CRITERIA} critères dans le tableau "criteria", utilise les "id" exacts ci-dessus.
- Sois EXIGEANT : un critère validé = clairement présent. En cas de doute → false.
- Niveau Débutant : on est plus indulgent dans le commentaire (ton encourageant) mais pas dans le score.
- Niveau Expert : aucune approximation tolérée.
- Cite des extraits du transcript dans les commentaires (« Quand tu dis "...", tu... »).
- Tutoie le commercial dans tes commentaires.
- Pas de langue de bois.
- Si le référentiel client mentionne un script ou une réponse type, vérifie si le commercial s'en est rapproché.`;

  const userMessage = `# CONTEXTE DE LA SESSION

Niveau : ${cfg.label}

Persona joué :
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

Évalue les ${TOTAL_CRITERIA} critères. Réponds en JSON pur.`;

  const response = await getAnthropic().messages.create({
    model: EVALUATOR_MODEL,
    max_tokens: 3500,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Évaluation vide");
  }

  const cleaned = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let raw: RawEvaluatorResponse;
  try {
    raw = JSON.parse(cleaned) as RawEvaluatorResponse;
  } catch (err) {
    throw new Error(
      `Impossible de parser l'évaluation Claude : ${(err as Error).message}\n---\n${cleaned.slice(0, 500)}`,
    );
  }

  // Map id → result, en se basant sur la liste officielle (sécurise contre id invalides ou manquants)
  const resultsById = new Map<string, RawCriterionResult>();
  for (const r of raw.criteria ?? []) {
    if (r && typeof r.id === "string") {
      resultsById.set(r.id, r);
    }
  }

  let totalPassed = 0;
  const categories: CategoryResult[] = SCORING_CATEGORIES.map((cat) => {
    const criteria = cat.criteria.map((c) => {
      const r = resultsById.get(c.id);
      const passed = Boolean(r?.passed);
      const comment =
        typeof r?.comment === "string" && r.comment.trim().length > 0
          ? r.comment.trim()
          : "(pas de commentaire fourni)";
      return { id: c.id, label: c.label, passed, comment };
    });
    const score = criteria.filter((c) => c.passed).length;
    totalPassed += score;
    return {
      key: cat.key as CategoryKey,
      label: cat.label,
      score,
      max: cat.criteria.length,
      criteria,
    };
  });

  const overall_score = Math.round((totalPassed / TOTAL_CRITERIA) * 100);

  return {
    overall_score,
    criteria_total: totalPassed,
    criteria_max: TOTAL_CRITERIA,
    categories,
    strengths: Array.isArray(raw.strengths)
      ? raw.strengths.slice(0, 5).map(String)
      : [],
    improvements: Array.isArray(raw.improvements)
      ? raw.improvements.slice(0, 5).map(String)
      : [],
    next_steps: Array.isArray(raw.next_steps)
      ? raw.next_steps.slice(0, 5).map(String)
      : [],
    outcome_summary:
      typeof raw.outcome_summary === "string" ? raw.outcome_summary : "",
  };
}

// Helper pour le typage côté UI
export { getCategoryByKey };
