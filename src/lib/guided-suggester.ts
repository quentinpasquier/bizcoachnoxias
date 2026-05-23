// Helpers Claude pour le builder guidé : suggère des personas et des
// objections à partir d'un contexte d'offre minimal (nom + value prop +
// pitch). Permet aux orgs clientes sans matrice formalisée de démarrer.

import { getAnthropic } from "./anthropic";

const SUGGEST_MODEL = "claude-sonnet-4-6";

export interface SuggestedPersona {
  label: string;
  role: string;
  typical_company: string;
  key_pains: string[];
  key_kpis: string[];
  motivations: string[];
  triggers: string[];
  decision_signals: string;
}

export interface OfferContext {
  name: string;
  sector: string;
  value_prop_one_liner: string;
  product_pitch: string;
  ideal_targets: string;
}

function parseJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

export async function suggestPersonas(
  ctx: OfferContext,
  count = 3,
): Promise<SuggestedPersona[]> {
  const system = `Tu es analyste commercial. À partir d'une offre B2B, tu génères ${count} profils de personas cibles distincts et complémentaires que les commerciaux pourraient appeler en prospection externalisée.

Règles :
- Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de texte autour).
- En français.
- ${count} personas distincts, complémentaires (rôles ou tailles d'entreprise différents).
- Chaque persona est concret : un rôle précis dans un type d'entreprise précis.
- key_pains, key_kpis, motivations, triggers : 3 à 4 items courts par catégorie (max 12 mots chacun).
- decision_signals : 1 phrase, ce qui le fait dire OUI à un RDV.

Format JSON EXACT :
{
  "personas": [
    {
      "label": "<label court, ex: 'Directeur Marketing PME'>",
      "role": "<rôle précis, ex: 'Directeur Marketing dans une PME SaaS 20-50 personnes'>",
      "typical_company": "<1 phrase sur la taille et le type d'entreprise>",
      "key_pains": ["<douleur 1>", "<douleur 2>", "<douleur 3>"],
      "key_kpis": ["<KPI 1>", "<KPI 2>", "<KPI 3>"],
      "motivations": ["<motivation 1>", "<motivation 2>", "<motivation 3>"],
      "triggers": ["<événement déclencheur 1>", "<événement déclencheur 2>"],
      "decision_signals": "<1 phrase>"
    }
  ]
}`;

  const user = `Contexte de l'offre :
- Nom : ${ctx.name || "(non renseigné)"}
- Secteur : ${ctx.sector || "(non renseigné)"}
- Promesse : ${ctx.value_prop_one_liner || "(non renseignée)"}
- Pitch : ${ctx.product_pitch || "(non renseigné)"}
- Cibles idéales connues : ${ctx.ideal_targets || "(à toi de proposer)"}

Génère ${count} personas adaptés.`;

  const response = await getAnthropic().messages.create({
    model: SUGGEST_MODEL,
    max_tokens: 3000,
    system,
    messages: [{ role: "user", content: user }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude n'a rien renvoyé");
  }

  const parsed = parseJson<{ personas: SuggestedPersona[] }>(block.text);
  if (!Array.isArray(parsed.personas)) {
    throw new Error("Format de réponse invalide");
  }
  return parsed.personas.slice(0, count);
}

export async function suggestObjections(
  ctx: OfferContext,
  count = 15,
): Promise<string[]> {
  const system = `Tu es analyste commercial. À partir d'une offre B2B, tu génères ${count} objections spécifiques que les prospects sont susceptibles de formuler pendant un appel de prospection téléphonique.

Règles :
- Réponds UNIQUEMENT en JSON valide.
- En français.
- ${count} objections distinctes, formulées comme un prospect les dirait à l'oral (1ère personne, ton direct, naturel).
- Couvre plusieurs catégories : prix, timing, autorité, besoin, confiance, concurrent, statu quo.
- Évite les généralités. Ancre les objections dans le contexte de l'offre (ex: si c'est un logiciel SaaS, "On a déjà un outil maison" est plus pertinent que "Pas intéressé").

Format JSON EXACT :
{
  "objections": ["<objection 1>", "<objection 2>", ...]
}`;

  const user = `Contexte de l'offre :
- Nom : ${ctx.name || "(non renseigné)"}
- Secteur : ${ctx.sector || "(non renseigné)"}
- Promesse : ${ctx.value_prop_one_liner || "(non renseignée)"}
- Pitch : ${ctx.product_pitch || "(non renseigné)"}
- Cibles : ${ctx.ideal_targets || "(non renseigné)"}

Génère ${count} objections spécifiques à cette offre.`;

  const response = await getAnthropic().messages.create({
    model: SUGGEST_MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: user }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude n'a rien renvoyé");
  }

  const parsed = parseJson<{ objections: string[] }>(block.text);
  if (!Array.isArray(parsed.objections)) {
    throw new Error("Format de réponse invalide");
  }
  return parsed.objections.map(String).filter(Boolean).slice(0, count);
}
