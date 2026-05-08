import { getAnthropic } from "./anthropic";
import type { PersonaProfile } from "./supabase/types";

const EXTRACT_MODEL = "claude-sonnet-4-6";

export interface ExtractedClientFields {
  name: string;
  sector: string | null;
  description: string | null;
  value_proposition: string | null;
  product_pitch: string;
  ideal_targets: string | null;
  typical_objections: string[];
  target_personas: string[];
  persona_profiles: PersonaProfile[];
}

const SCHEMA = `{
  "name": "<nom du client tel que mentionné dans les docs (ex: 'DOKO', 'Cabinet Mercier')>",
  "sector": "<étiquette courte du secteur, ex: 'Agence marketing digital'>",
  "description": "<1-2 phrases qui décrivent ce que fait le client>",
  "value_proposition": "<la promesse de valeur en une phrase, idéalement avec un chiffre>",
  "product_pitch": "<le pitch que le commercial doit porter en RDV, en 1-2 phrases concrètes>",
  "ideal_targets": "<une phrase qui résume les cibles idéales (rôles, secteurs, tailles)>",
  "typical_objections": ["<top 8 objections les plus représentatives, formulées comme un prospect les dirait à l'oral en première personne>", "..."],
  "target_personas": ["<liste des labels distincts des personas, ex: ['Avocat', 'Gérant Escape Game']>"],
  "persona_profiles": [
    {
      "id": "<slug du label, minuscule, ex: 'avocat', 'gerant-escape-game'>",
      "label": "<label du persona, ex: 'Avocat'>",
      "role": "<intitulé précis du rôle, ex: 'Avocat associé en droit des affaires'>",
      "typical_company": "<1 phrase : taille et type d'entreprise typique pour ce persona>",
      "key_pains": ["<3 douleurs principales spécifiques à ce persona, telles que décrites dans les docs>", "...", "..."],
      "key_kpis": ["<2-3 KPI/métriques que ce persona surveille>", "...", "..."],
      "main_objections": ["<3-5 objections les plus représentatives pour CE persona spécifiquement>", "...", "..."],
      "decision_signals": "<1 phrase : ce qui fait dire OUI à un RDV pour ce persona>",
      "prep_briefing": "<2-3 paragraphes en français à destination du commercial Noxias pour préparer l'appel : qui il est, ce qui le préoccupe, ce qu'il faut éviter, ce qu'il faut creuser. Ton direct, concret, dirigeant à dirigeant. Pas de jargon corporate.>"
    }
  ]
}`;

export async function extractClientFields(
  syncedContent: string,
): Promise<ExtractedClientFields> {
  const system = `Tu es analyste commercial chez Noxias, agence de prospection externalisée. Tu reçois la matrice de prospection et la boîte à outils d'un client. Ton rôle : extraire un profil client complet et générer les briefings personas qui aideront les commerciaux à préparer leurs appels.

Règles :
- Réponds en FRANÇAIS uniquement.
- Renvoie UNIQUEMENT un JSON valide (pas de markdown, pas de texte avant ou après).
- Sois fidèle au contenu : ne reformule pas, ne crée pas, garde le ton du client.
- Pour les objections : reformule comme un prospect les dirait (1ère personne).
- Pour le briefing persona : écris à destination du commercial Noxias qui va appeler. Style direct, concret, dirigeant à dirigeant. Inclut : qui il est, ce qui le préoccupe vraiment, le piège à éviter, l'angle qui marche.
- target_personas et persona_profiles doivent contenir EXACTEMENT les mêmes personas (la liste de labels et les profils correspondent un à un).
- Si le doc ne mentionne qu'un seul persona, génère un seul profil.

Schéma JSON EXACT à respecter :

${SCHEMA}`;

  const user = `Contenu fusionné des docs (matrice + boîte à outils + tous les fichiers uploadés) :

---
${syncedContent.slice(0, 80000)}
---

Extrait le profil complet du client + les profils personas avec briefing. Réponds en JSON pur.`;

  const response = await getAnthropic().messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 6000,
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
    name: typeof parsed.name === "string" ? parsed.name.trim() : "Client sans nom",
    sector: parsed.sector ?? null,
    description: parsed.description ?? null,
    value_proposition: parsed.value_proposition ?? null,
    product_pitch:
      typeof parsed.product_pitch === "string"
        ? parsed.product_pitch.trim()
        : "(à compléter)",
    ideal_targets: parsed.ideal_targets ?? null,
    typical_objections: Array.isArray(parsed.typical_objections)
      ? parsed.typical_objections.map(String).filter(Boolean).slice(0, 12)
      : [],
    target_personas: Array.isArray(parsed.target_personas)
      ? parsed.target_personas.map(String).filter(Boolean).slice(0, 8)
      : [],
    persona_profiles: Array.isArray(parsed.persona_profiles)
      ? parsed.persona_profiles
          .filter((p) => p && typeof p === "object" && typeof p.label === "string")
          .map((p) => ({
            id:
              typeof p.id === "string" && p.id.length > 0
                ? p.id
                : slugify(p.label),
            label: p.label,
            role: typeof p.role === "string" ? p.role : "",
            typical_company:
              typeof p.typical_company === "string" ? p.typical_company : "",
            key_pains: Array.isArray(p.key_pains)
              ? p.key_pains.map(String).filter(Boolean).slice(0, 5)
              : [],
            key_kpis: Array.isArray(p.key_kpis)
              ? p.key_kpis.map(String).filter(Boolean).slice(0, 5)
              : [],
            main_objections: Array.isArray(p.main_objections)
              ? p.main_objections.map(String).filter(Boolean).slice(0, 8)
              : [],
            decision_signals:
              typeof p.decision_signals === "string" ? p.decision_signals : "",
            prep_briefing:
              typeof p.prep_briefing === "string" ? p.prep_briefing : "",
          }))
          .slice(0, 8)
      : [],
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
