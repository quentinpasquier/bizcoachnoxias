import { getAnthropic } from "./anthropic";
import type { Client, QuizData, QuizQuestion } from "./supabase/types";

// Haiku 4.5 : assez puissant pour rédiger 12 questions QCM à partir
// des docs déjà structurés, et 5-10x plus rapide que Sonnet pour
// rentrer dans la limite Vercel Hobby (10s).
const QUIZ_MODEL = "claude-haiku-4-5-20251001";
const SOURCE_VERSION = "v2";

const SCHEMA = `{
  "questions": [
    {
      "id": "q1",
      "category": "<'qui' | 'pourquoi' | 'quoi' | 'douleurs' | 'objections'>",
      "question": "<énoncé clair, formulé comme un manager qui interroge son commercial à l'oral>",
      "options": ["<bonne réponse ou distracteur 1>", "<distracteur 2>", "<distracteur 3>", "<distracteur 4>"],
      "correct_index": <0..3>,
      "explanation": "<1-2 phrases qui expliquent POURQUOI c'est la bonne réponse, en référence aux docs du client. Ton pédagogique mais direct.>"
    }
  ]
}`;

export async function generateQuizFromClient(
  client: Pick<
    Client,
    | "name"
    | "sector"
    | "description"
    | "value_proposition"
    | "product_pitch"
    | "ideal_targets"
    | "typical_objections"
    | "persona_profiles"
    | "synced_content"
  >,
): Promise<QuizData> {
  const personasSummary = (client.persona_profiles ?? [])
    .map(
      (p) =>
        `Persona: ${p.label}
Rôle: ${p.role}
Entreprise type: ${p.typical_company}
Douleurs: ${p.key_pains.join(" | ")}
KPI: ${p.key_kpis.join(" | ")}
Objections clés: ${p.main_objections.join(" | ")}
Signaux décision: ${p.decision_signals}`,
    )
    .join("\n\n---\n\n");

  const objectionsSample = (client.typical_objections ?? [])
    .slice(0, 30)
    .map((o, i) => `${i + 1}. ${o}`)
    .join("\n");

  const system = `Tu es responsable formation chez Noxias, agence de prospection B2B externalisée. Ton rôle : créer un quiz de validation pour un commercial qui doit prospecter un nouveau client.

Le quiz a 5 catégories :
1. **qui** : qui prospecte-t-on ? (cibles idéales, personas, types d'entreprises)
2. **pourquoi** : pourquoi prospecter ce client ? (proposition de valeur, promesse, ROI)
3. **quoi** : qu'est-ce qu'on vend exactement ? (pitch produit/service)
4. **douleurs** : quelles problématiques rencontrent les prospects ? (pains spécifiques aux personas)
5. **objections** : comment répondre aux objections fréquentes ? (réponses tactiques aux objections de la boîte à outils)

Règles strictes :
- Réponds en FRANÇAIS uniquement.
- Renvoie UNIQUEMENT un JSON valide (pas de markdown, pas de texte avant ou après).
- Génère EXACTEMENT 12 questions : 2 'qui', 2 'pourquoi', 2 'quoi', 3 'douleurs', 3 'objections'.
- Pour chaque question : 4 options, dont 1 seule juste. Les distracteurs doivent être plausibles (pas évidents) mais clairement faux pour qui a lu les docs. Évite 'toutes les réponses' / 'aucune des réponses'.
- Les questions doivent être discriminantes : un commercial qui n'a pas lu les docs ne doit pas pouvoir bluffer.
- Pour la catégorie 'objections' : pose 3 objections différentes du prospect et demande la MEILLEURE façon d'y répondre (pas la formulation exacte de l'objection).
- Pour 'douleurs' : pose une mise en situation concrète d'un persona précis et demande quelle est SA problématique principale.
- explanation : explique pourquoi c'est juste, en référence directe au contenu du client.

Schéma JSON EXACT :

${SCHEMA}`;

  const user = `Voici tout ce qu'il faut savoir sur le client à mémoriser :

CLIENT : ${client.name}
Secteur : ${client.sector ?? "(non précisé)"}
Description : ${client.description ?? "(non précisée)"}

VALEUR :
- Promesse : ${client.value_proposition ?? "(non précisée)"}
- Pitch produit : ${client.product_pitch ?? "(non précisé)"}
- Cibles idéales : ${client.ideal_targets ?? "(non précisées)"}

PERSONAS :
${personasSummary || "(aucun persona défini)"}

OBJECTIONS TYPIQUES (${client.typical_objections?.length ?? 0} au total) :
${objectionsSample || "(aucune objection)"}

EXTRAIT DOCS (pour citer des éléments précis) :
---
${(client.synced_content ?? "").slice(0, 12000)}
---

Génère le quiz de 12 questions selon le schéma. Réponds en JSON pur.`;

  const response = await getAnthropic().messages.create({
    model: QUIZ_MODEL,
    max_tokens: 5000,
    system,
    messages: [{ role: "user", content: user }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Quiz du cerveau IA vide");
  }

  const cleaned = block.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: { questions?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Impossible de parser le quiz : ${(err as Error).message}\n---\n${cleaned.slice(0, 500)}`,
    );
  }

  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const questions: QuizQuestion[] = rawQuestions
    .map((q: unknown, idx: number) => sanitizeQuestion(q, idx))
    .filter((q): q is QuizQuestion => q !== null)
    .slice(0, 15);

  if (questions.length < 4) {
    throw new Error(
      `Quiz trop court (${questions.length} questions valides). Ré-essaie ou complète les docs du client.`,
    );
  }

  return {
    questions,
    generated_at: new Date().toISOString(),
    source_version: SOURCE_VERSION,
  };
}

function sanitizeQuestion(q: unknown, idx: number): QuizQuestion | null {
  if (!q || typeof q !== "object") return null;
  const obj = q as Record<string, unknown>;
  const question = typeof obj.question === "string" ? obj.question.trim() : "";
  if (!question) return null;

  const optsRaw = Array.isArray(obj.options) ? obj.options : [];
  const options = optsRaw
    .map((o) => (typeof o === "string" ? o.trim() : ""))
    .filter(Boolean);
  if (options.length < 3 || options.length > 5) return null;

  const correctIdx =
    typeof obj.correct_index === "number"
      ? Math.floor(obj.correct_index)
      : -1;
  if (correctIdx < 0 || correctIdx >= options.length) return null;

  const cat = typeof obj.category === "string" ? obj.category : "";
  const validCategories = ["qui", "pourquoi", "quoi", "douleurs", "objections"];
  const category = validCategories.includes(cat) ? cat : "quoi";

  const explanation =
    typeof obj.explanation === "string" ? obj.explanation.trim() : "";

  const id =
    typeof obj.id === "string" && obj.id.length > 0
      ? obj.id
      : `q${idx + 1}`;

  return {
    id,
    category: category as QuizQuestion["category"],
    question,
    options,
    correct_index: correctIdx,
    explanation,
  };
}

export const QUIZ_CATEGORY_LABELS: Record<QuizQuestion["category"], string> = {
  qui: "Qui prospecte-t-on ?",
  pourquoi: "Pourquoi prospecter ?",
  quoi: "Qu'est-ce qu'on vend ?",
  douleurs: "Quelles douleurs ?",
  objections: "Réponses aux objections",
};

export const QUIZ_CATEGORY_COLORS: Record<QuizQuestion["category"], string> = {
  qui: "#4A8FE7",
  pourquoi: "#9d6bff",
  quoi: "#3CC879",
  douleurs: "#F5A524",
  objections: "#E94B4B",
};
