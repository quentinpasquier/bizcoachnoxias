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

interface RawQuoteRewrite {
  category?: string;
  context?: string;
  your_words?: string;
  issue?: string;
  better?: string;
}

interface RawEvaluatorResponse {
  criteria: RawCriterionResult[];
  strengths: string[];
  improvements: string[];
  next_steps: string[];
  outcome_summary: string;
  quote_rewrites?: RawQuoteRewrite[];
}

const RESPONSE_SCHEMA = `{
  "criteria": [
    { "id": "<id du critère>", "passed": <true|false>, "comment": "<1 phrase courte qui justifie le score, citation possible>" }
    // ... une entrée par critère, dans n'importe quel ordre
  ],
  "strengths": ["<3 forces concrètes>", "...", "..."],
  "improvements": ["<3 axes d'amélioration concrets>", "...", "..."],
  "next_steps": ["<3 actions concrètes pour la prochaine session>", "...", "..."],
  "outcome_summary": "<2 à 3 phrases : ce qui s'est passé, pourquoi, ce que ça dit du commercial>",
  "quote_rewrites": [
    {
      "category": "<'accroche' | 'decouverte' | 'valeur' | 'objections' | 'closing'>",
      "context": "<1 phrase qui décrit ce qui se passait juste avant. Ex: 'Le prospect vient de dire qu'il a déjà un prestataire'>",
      "your_words": "<citation EXACTE de ce que le commercial a dit, mot pour mot depuis le transcript. Pas de paraphrase>",
      "issue": "<1 phrase qui explique pourquoi cette formulation n'a pas marché>",
      "better": "<reformulation concrète, prête à l'emploi, que le commercial peut copier-coller la prochaine fois. C'est le LEVIER d'amélioration. Doit être une vraie phrase orale, pas un conseil abstrait.>"
    }
    // ... 4 à 6 entrées au total
  ]
}`;

function buildCriteriaListForPrompt(): string {
  return SCORING_CATEGORIES.map((cat) => {
    const lines = cat.criteria.map(
      (c) => `  - id: "${c.id}". ${c.label} : ${c.description}`,
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

  const system = `Tu es coach commercial senior chez Noxias, agence de prospection B2B externalisée. Tu évalues les commerciaux Noxias avec rigueur exigeante mais bienveillante. Style : direct, concret, dirigeant à dirigeant. Pas de blabla, pas d'anglicismes.

# CONTEXTE DU JOB

Tu analyses un COLD CALL B2B TÉLÉPHONIQUE. Pas une démo. Pas un RDV qualifié. C'est un appel à froid, 3 à 6 minutes max, dont l'unique but est de DÉCROCHER UN RDV (généralement avec un commercial senior ou un expert produit qui prendra le relais).

Conséquences pour ton évaluation :
- La brièveté est une vertu. Un commercial qui déroule un monologue de 2 min en ouverture rate plus de critères qu'un qui pose une bonne question en 20 secondes.
- L'objectif n'est PAS d'expliquer le produit en détail, c'est d'éveiller l'intérêt pour décrocher un RDV.
- Le prospect n'a pas demandé l'appel : il est par défaut occupé / méfiant / sceptique. C'est normal.
- Le RDV est la métrique reine. Tout ce qui aide à l'obtenir mérite d'être valorisé.
- Ne pas pénaliser l'absence de pitch produit détaillé : ce n'est PAS l'enjeu du cold call.

# CRITÈRES À ÉVALUER (chacun = 0 ou 1, binaire)

${criteriaList}

# FORMAT DE RÉPONSE

Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant/après. Schéma EXACT :

${RESPONSE_SCHEMA}

# RÈGLES
- TOUJOURS inclure les ${TOTAL_CRITERIA} critères dans le tableau "criteria", utilise les "id" exacts ci-dessus.
- Sois EXIGEANT mais ÉQUITABLE : un critère validé = clairement présent. En cas de doute légitime → false. En cas de doute marginal (geste qui va dans le bon sens) → true.
- Niveau Débutant : ton encourageant dans les commentaires, mais score honnête.
- Niveau Expert : pas de cadeau.
- Cite des extraits du transcript dans les commentaires (« Quand tu dis "...", tu... »).
- Tutoie le commercial dans tes commentaires.
- Pas de langue de bois.
- Si le référentiel client mentionne un script ou une réponse type, vérifie si le commercial s'en est rapproché.
- IMPORTANT : Si un RDV a été obtenu, c'est qu'au moins le minimum a été fait. Les critères de closing sont quasi-systématiquement validés dans ce cas.

# QUOTE_REWRITES · le plus important pour le commercial

Ton meilleur livrable, c'est l'aide concrète pour s'améliorer.
Génère 4 à 6 quote_rewrites qui :
- Citent EXACTEMENT, mot pour mot, ce que le commercial a dit dans le transcript (your_words). Pas de paraphrase, pas d'invention.
- Identifient un moment précis (context) où une meilleure formulation aurait fait la différence.
- Expliquent en 1 phrase pourquoi (issue) : trop fermé, trop générique, capitulation, manque d'acquittement, jargon, etc.
- Donnent une RÉPLIQUE PRÊTE À L'EMPLOI (better) : une phrase orale concrète que le commercial pourra réutiliser tel quel la prochaine fois. Pas un conseil abstrait ('sois plus à l'écoute'), une PHRASE ('Quand tu dis "pas le budget", c'est lié au timing ou à la priorité ?').
- Couvrent plusieurs catégories (mélange accroche / découverte / valeur / objections / closing).
- Priorité : les objections mal gérées et les questions fermées qui auraient dû être ouvertes.

Si la session est très courte ou très réussie, génère au moins 3 quote_rewrites avec ce qui peut quand même être affiné.`;

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
    max_tokens: 5500,
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
      `Impossible de parser l'évaluation du cerveau IA : ${(err as Error).message}\n---\n${cleaned.slice(0, 500)}`,
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

  let overall_score = Math.round((totalPassed / TOTAL_CRITERIA) * 100);
  // Cold call : décrocher un RDV vaut au minimum 50/100, peu importe le reste
  // de l'exécution. C'est la métrique reine du métier.
  if (input.appointmentSecured && overall_score < 50) {
    overall_score = 50;
  }

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
    quote_rewrites: Array.isArray(raw.quote_rewrites)
      ? raw.quote_rewrites
          .filter(
            (q) =>
              q &&
              typeof q.your_words === "string" &&
              q.your_words.length > 0 &&
              typeof q.better === "string" &&
              q.better.length > 0,
          )
          .map((q) => {
            const validCats = ["accroche", "decouverte", "valeur", "objections", "closing"];
            const category = validCats.includes(q.category ?? "")
              ? (q.category as CategoryKey)
              : ("objections" as CategoryKey);
            return {
              category,
              context: typeof q.context === "string" ? q.context.trim() : "",
              your_words: q.your_words!.trim(),
              issue: typeof q.issue === "string" ? q.issue.trim() : "",
              better: q.better!.trim(),
            };
          })
          .slice(0, 8)
      : [],
  };
}

// Helper pour le typage côté UI
export { getCategoryByKey };
