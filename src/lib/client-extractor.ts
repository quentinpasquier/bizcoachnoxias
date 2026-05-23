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
  "typical_objections": ["<INCLUS TOUTES LES OBJECTIONS de la boîte à outils, généralement 25-35. Chaque objection est formulée comme un prospect la dirait à l'oral, en 1ère personne (ex: 'On a déjà un prestataire'). Ne synthétise pas, ne déduplique pas si elles ont des nuances différentes. Vise EXHAUSTIF.>", "...", "..."],
  "target_personas": ["<liste des labels distincts des personas, ex: ['Avocat', 'Gérant Escape Game']>"],
  "persona_profiles": [
    {
      "id": "<slug du label, minuscule, ex: 'avocat', 'gerant-escape-game'>",
      "label": "<label du persona, ex: 'Avocat'>",
      "role": "<intitulé précis du rôle, ex: 'Avocat associé en droit des affaires'>",
      "typical_company": "<1 phrase : taille et type d'entreprise typique pour ce persona>",
      "key_pains": ["<3-5 douleurs principales spécifiques à ce persona, telles que décrites dans les docs>", "...", "..."],
      "key_kpis": ["<2-3 KPI/métriques que ce persona surveille>", "...", "..."],
      "main_objections": ["<8 à 12 objections les plus représentatives pour CE persona spécifiquement, sélectionnées intelligemment depuis la liste complète des objections de la boîte à outils. Chaque persona doit avoir un large panel pour entraîner les commerciaux à toutes les variantes. Une objection peut apparaître chez plusieurs personas si elle est universelle.>", "...", "..."],
      "decision_signals": "<1 phrase : ce qui fait dire OUI à un RDV pour ce persona>",
      "prep_briefing": "<2-3 paragraphes en français à destination du commercial Noxias pour préparer l'appel : qui il est, ce qui le préoccupe, ce qu'il faut éviter, ce qu'il faut creuser. Ton direct, concret, dirigeant à dirigeant. Pas de jargon corporate.>",
      "prep_bullets": ["<EXACTEMENT 4 missions courtes (max 12 mots), formulées comme des consignes 'Mission Impossible' à un commercial. Format impératif et tactique. Exemples : 'Vise le coût d'acquisition, pas la visibilité', 'Évite le SEO long terme, attaque par le SEA', 'Demande son taux de remplissage avant tout pitch'. Sois précis, actionnable, opérationnel. Pas de description, des ORDRES.>"]
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

OBJECTIONS - règle critique :
- La boîte à outils du client contient typiquement entre 25 et 35 objections différentes, classées (par catégorie : prix, timing, autorité, besoin, confiance, concurrent...).
- AVANT d'écrire ton JSON, lis et identifie EXHAUSTIVEMENT toutes les objections présentes dans les docs (pas seulement les premières que tu vois). C'est crucial.
- typical_objections doit contenir TOUTES les objections de la boîte à outils, sans exception. N'en omets aucune sous prétexte qu'elle se ressemble, les nuances comptent pour entraîner les commerciaux.
- Pour chaque persona, sélectionne 8 à 12 objections parmi la liste complète, celles qui sont les plus probables pour ce profil. Une même objection peut apparaître chez plusieurs personas si elle est universelle (ex: prix, timing).
- Cible : un commercial qui s'entraîne sur n'importe quel persona doit affronter une diversité large d'objections, pas toujours les mêmes 3.

Schéma JSON EXACT à respecter :

${SCHEMA}`;

  const user = `Contenu fusionné des docs (matrice + boîte à outils + tous les fichiers uploadés) :

---
${syncedContent.slice(0, 120000)}
---

Étape 1 : parcours TOUTE la boîte à outils et compte mentalement le nombre exact d'objections différentes que tu y trouves (généralement 25 à 35).
Étape 2 : extrait le profil complet du client + les profils personas avec briefing.
Étape 3 : remplis typical_objections avec TOUTES les objections trouvées (sans en oublier).
Étape 4 : pour chaque persona, sélectionne 8-12 objections parmi la liste complète qui collent à ce profil.

Réponds en JSON pur, rien d'autre.`;

  const response = await getAnthropic().messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 12000,
    system,
    messages: [{ role: "user", content: user }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Extraction du cerveau IA vide");
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
      ? parsed.typical_objections.map(String).filter(Boolean).slice(0, 40)
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
              ? p.key_pains.map(String).filter(Boolean).slice(0, 6)
              : [],
            key_kpis: Array.isArray(p.key_kpis)
              ? p.key_kpis.map(String).filter(Boolean).slice(0, 5)
              : [],
            main_objections: Array.isArray(p.main_objections)
              ? p.main_objections.map(String).filter(Boolean).slice(0, 15)
              : [],
            decision_signals:
              typeof p.decision_signals === "string" ? p.decision_signals : "",
            prep_briefing:
              typeof p.prep_briefing === "string" ? p.prep_briefing : "",
            prep_bullets: Array.isArray(p.prep_bullets)
              ? p.prep_bullets.map(String).filter(Boolean).slice(0, 4)
              : [],
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
