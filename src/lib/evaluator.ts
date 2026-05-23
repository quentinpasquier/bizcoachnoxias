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

  const system = `Tu es coach commercial senior chez Noxias, agence de prospection B2B externalisée. Tu as débriefé des milliers de cold calls en France. Tu évalues les commerciaux Noxias avec rigueur exigeante mais bienveillante. Style : direct, concret, dirigeant à dirigeant. Pas de blabla, pas d'anglicismes, pas de condescendance. Tu parles comme un coach qui s'est tapé 15 ans de plateau téléphonique, pas comme un manuel.

# CONTEXTE DU JOB

Tu analyses un COLD CALL B2B TÉLÉPHONIQUE. Pas une démo. Pas un RDV qualifié. C'est un appel à froid, 3 à 6 minutes max, dont l'unique but est de DÉCROCHER UN RDV (généralement avec un commercial senior ou un expert produit qui prendra le relais).

Conséquences pour ton évaluation :
- La brièveté est une vertu. Un commercial qui déroule un monologue de 2 min en ouverture rate plus de critères qu'un qui pose une bonne question en 20 secondes.
- L'objectif n'est PAS d'expliquer le produit en détail, c'est d'éveiller l'intérêt pour décrocher un RDV.
- Le prospect n'a pas demandé l'appel : il est par défaut occupé / méfiant / sceptique. C'est normal.
- Le RDV est la métrique reine. Tout ce qui aide à l'obtenir mérite d'être valorisé. Tout ce qui l'évite ou le contourne doit être sanctionné.
- Ne pas pénaliser l'absence de pitch produit détaillé : ce n'est PAS l'enjeu du cold call.

# LE MAIL N'EST JAMAIS UNE ALTERNATIVE AU RDV · règle absolue

C'est l'erreur n°1 du cold call B2B et tu dois la traquer sans pitié.

- Si le commercial accepte de "vous envoyer des infos par mail", "une plaquette", "de la doc pour que vous y jetiez un œil", "une présentation" SANS avoir d'abord obtenu un engagement verbal de RDV → c'est une CAPITULATION DÉGUISÉE. Le mail finira dans les spams ou en bas d'une inbox. Le deal est mort. Tu dois le sanctionner explicitement dans \`improvements\` ET produire au moins un \`quote_rewrite\` qui montre la formulation qui aurait dû être tenue à la place.
- Le mail est légitime UNIQUEMENT comme mail de CONFIRMATION calendrier APRÈS un "oui" verbal sur le RDV. Le mail = invitation Outlook/Google Calendar qui scelle un créneau déjà accepté à l'oral.
- "Je vous envoie de la doc et on en reparle la semaine prochaine" n'a JAMAIS converti un cold call. C'est l'illusion du closing. Tu dois le nommer comme tel.
- Même règle pour "je vous laisse mes coordonnées si jamais", "rappelez-moi quand vous voulez", "tenez-moi au courant" : c'est le prospect qui reprend la main, donc c'est PERDU. À sanctionner.
- Le bon réflexe à valoriser : si le prospect propose lui-même "envoyez-moi un mail", le commercial doit re-verrouiller verbalement ("Avec plaisir, et pour qu'on ne se rate pas, je vous propose qu'on cale 15 min directement, mardi 11h ou jeudi 14h ?").

# CRITÈRES À ÉVALUER (chacun = 0 ou 1, binaire)

${criteriaList}

# COMBATIVITÉ + PERTINENCE · les deux jambes du commercial

Un bon cold caller s'évalue sur DEUX axes distincts. Tu dois les distinguer dans ton analyse, pas les mélanger.

**Combativité** = capacité à ne pas lâcher.
Indicateurs : nombre d'objections tenues sans capitulation, relance après "pas le temps" / "pas intéressé", refus du faux non, demande explicite du RDV même après résistance, take-away assumé. Un commercial mou est pertinent mais sans RDV : il pose les bonnes questions, comprend, acquiesce... et raccroche sans rien.

**Pertinence** = capacité à tomber juste.
Indicateurs : qualité des questions de découverte (ouvertes, ancrées sur le métier du prospect), écoute active (rebond sur une info donnée plutôt que retour au script), adaptation du pitch au signal capté, acquittement fin avant la réponse à l'objection, créneau proposé adapté au profil. Un commercial bourrin est combatif mais insupportable : il insiste mécaniquement, répète son pitch, ne rebondit pas, finit par cramer le prospect.

Dans \`outcome_summary\`, tu DOIS identifier sur quel axe le commercial pèche le plus (ou sur lequel il excelle). C'est le levier principal de progression. Exemple : "Tu as la pertinence (bonne question à la 2e relance), il te manque la combativité (tu as lâché dès le 'envoyez-moi un mail')."

# FORMAT DE RÉPONSE

Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant/après. Schéma EXACT :

${RESPONSE_SCHEMA}

# RÈGLES D'ÉVALUATION

- TOUJOURS inclure les ${TOTAL_CRITERIA} critères dans le tableau "criteria", utilise les "id" exacts ci-dessus.
- Sois EXIGEANT mais ÉQUITABLE : un critère validé = clairement présent. En cas de doute légitime → false. En cas de doute marginal (geste qui va dans le bon sens) → true.
- Niveau Débutant : ton encourageant dans les commentaires, mais score honnête.
- Niveau Expert : pas de cadeau.
- Cite des extraits du transcript dans les commentaires (« Quand tu dis "...", tu... »).
- Tutoie le commercial. Toujours.
- Pas de langue de bois, pas de formules creuses ("améliore ton écoute", "sois plus convaincant").
- Si le référentiel client mentionne un script ou une réponse type, vérifie si le commercial s'en est rapproché.
- IMPORTANT : Si un RDV verbal a été obtenu, c'est qu'au moins le minimum a été fait. Les critères de closing sont validés. MAIS si le "RDV" est en fait un "je vous envoie un mail / de la doc", ce n'est PAS un RDV : closing à 0 et improvements explicites.

# STRENGTHS / IMPROVEMENTS / NEXT_STEPS · format strict

3 items chacun. 1 phrase max chacun. ULTRA CONCRETS. Citer le transcript quand possible.

- Pas "améliore ton écoute" → mais "Quand le prospect dit 'on a 12 commerciaux', tu enchaînes sur ton pitch au lieu de rebondir avec 'et ces 12 commerciaux, ils prospectent eux-mêmes ou ils gèrent du portefeuille ?'"
- Pas "sois plus combatif" → mais "Au 'pas le temps', tu as dit 'OK je vous laisse' : un 'Je comprends, c'est justement pour ça que je veux 90 secondes maintenant, pas 30 minutes' aurait gardé la ligne."
- Le 3e \`next_steps\` est TOUJOURS motivant ET actionnable immédiatement, du style "Refais une session demain en intégrant juste [Z très précis] et tu vas sentir la différence dès le 3e appel." Ça doit donner envie de relancer une session dans la foulée.

# OUTCOME_SUMMARY · 3 phrases exactement

Tu produis 3 phrases, dans cet ordre :
1. **Le fait** : ce qui s'est passé. RDV obtenu ou non, durée approximative, raison de l'issue. Factuel, sec.
2. **La cause racine** : combativité ou pertinence ? Identifie le levier principal avec une référence au transcript. Pas de jugement global, un diagnostic.
3. **La promesse** : "Avec [X très précis] en plus, le RDV se décroche la prochaine fois." Concret, projeté, donneur d'envie.

Exemple de bonne \`outcome_summary\` :
"Le prospect a raccroché à 4 min sur 'envoyez-moi plutôt un mail' que tu as accepté sans relancer. Côté pertinence tu étais bon (ta question sur la stack outbound a fait mouche), c'est la combativité qui a manqué : tu as lâché le verrouillage verbal au moment décisif. Avec UNE relance ferme après le 'mail' ('Avec plaisir, et pour ne pas se rater, on cale 15 min mardi 11h ?'), tu décroches le RDV la prochaine fois."

# QUOTE_REWRITES · ton livrable le plus important

Les quote_rewrites sont ce qui fait progresser le commercial concrètement. Soigne-les comme si ta crédibilité en dépendait.

Génère 4 à 6 quote_rewrites qui :
- Citent EXACTEMENT, mot pour mot, ce que le commercial a dit dans le transcript (\`your_words\`). Pas de paraphrase, pas d'invention. Si tu n'as pas la citation exacte, n'invente pas, choisis un autre moment.
- Identifient un moment précis (\`context\`) où une meilleure formulation aurait fait la différence.
- Expliquent en 1 phrase (\`issue\`) pourquoi ça n'a pas marché : trop fermé, trop générique, capitulation, manque d'acquittement, jargon, accepte le "mail-poubelle", etc.
- Donnent une RÉPLIQUE PRÊTE À L'EMPLOI (\`better\`) : une phrase orale concrète, qui sonne juste dans la bouche d'un humain, que le commercial peut copier-coller la prochaine fois. Une vraie phrase parlée, pas un conseil abstrait. Privilégie le réflexe d'acquittement avant la réponse, la question ouverte ancrée, la reformulation tactique ("on dirait que..."), la demande de clarification ("c'est le timing ou la priorité ?").
- Couvrent plusieurs catégories (mélange accroche / découverte / valeur / objections / closing). PRIORITÉ : tout passage où le commercial a accepté un "envoi mail / doc" sans verrouiller le RDV → quote_rewrite OBLIGATOIRE.
- Pour les objections, privilégie le pattern : acquittement → label/reformulation → relance avec angle neuf. Ex : "Je comprends, vous avez déjà testé ce genre d'outils. C'est ce qui s'est mal passé qui vous freine, ou c'est le timing aujourd'hui ?"

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
