import { getAnthropic } from "./anthropic";

export interface ExtractedClientFields {
  target_personas: string[];
  typical_objections: string[];
  product_pitch: string | null;
  value_proposition: string | null;
  ideal_targets: string | null;
}

const EXTRACT_MODEL = "claude-sonnet-4-6";

const SCHEMA = `{
  "target_personas": ["<liste des personas distincts mentionnés, ex: ['Avocat', 'Gérant Escape Game']>"],
  "typical_objections": ["<top 8 objections les plus représentatives, telles qu'un prospect les formulerait à l'oral, ex: 'J\\'ai déjà une agence et j\\'en suis satisfait'>"],
  "product_pitch": "<1 phrase synthétique : ce que le commercial pitch concrètement (offre + bénéfice principal)>",
  "value_proposition": "<1 phrase : la promesse de valeur unique, idéalement avec un chiffre>",
  "ideal_targets": "<1 phrase ou liste : à qui s'adresse cette offre (rôles, secteurs)>"
}`;

export async function extractClientFields(
  syncedContent: string,
  clientName: string,
): Promise<ExtractedClientFields> {
  const system = `Tu es analyste commercial chez Noxias, agence de prospection externalisée. Tu reçois la matrice de prospection et la boîte à outils d'un client. Ton rôle : extraire les champs structurés qui alimentent l'outil de coaching.

Règles :
- Réponds en FRANÇAIS uniquement.
- Renvoie UNIQUEMENT un JSON valide (pas de markdown, pas de texte avant ou après).
- Sois fidèle au contenu : ne reformule pas, ne crée pas, garde le ton du client.
- Pour les objections, reformule-les comme un prospect les dirait à l'oral, en première personne (ex : « J'ai déjà un prestataire »).
- Schéma EXACT à respecter :

${SCHEMA}`;

  const user = `Client : ${clientName}

Contenu fusionné des docs (matrice + boîte à outils) :

---
${syncedContent.slice(0, 60000)}
---

Extrait les 5 champs selon le schéma JSON. Réponds en JSON pur.`;

  const response = await getAnthropic().messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: user }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Extraction Claude vide");
  }

  const cleaned = block.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: ExtractedClientFields;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Impossible de parser l'extraction : ${(err as Error).message}\n---\n${cleaned.slice(0, 500)}`,
    );
  }

  return {
    target_personas: Array.isArray(parsed.target_personas)
      ? parsed.target_personas.map(String).filter(Boolean).slice(0, 8)
      : [],
    typical_objections: Array.isArray(parsed.typical_objections)
      ? parsed.typical_objections.map(String).filter(Boolean).slice(0, 12)
      : [],
    product_pitch: parsed.product_pitch ?? null,
    value_proposition: parsed.value_proposition ?? null,
    ideal_targets: parsed.ideal_targets ?? null,
  };
}
