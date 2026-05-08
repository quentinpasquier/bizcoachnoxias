import { getAnthropic } from "./anthropic";
import type { Client, Difficulty, Gender, Scenario } from "./supabase/types";

const SCENARIO_MODEL = "claude-sonnet-4-6";

const SCHEMA = `{
  "persona_label": "<étiquette générique du persona joué, ex: 'Avocat', 'Gérant Escape Game', 'DAF holding'>",
  "persona_name": "<prénom + nom français crédible, cohérent avec le genre>",
  "persona_role": "<intitulé exact du poste, ex: 'Avocat associé en droit des affaires'>",
  "company_name": "<nom de l'entreprise/cabinet/établissement, fictif mais crédible>",
  "company_context": "<2-3 phrases : taille, ville, secteur, particularités>",
  "current_situation": "<2-3 phrases : ce que vit le prospect en ce moment, déclencheurs potentiels (ex: 'Vient de refondre son site, baisse de trafic constatée le mois dernier')>",
  "hidden_pain_points": ["<3 douleurs spécifiques que ce prospect a, qu'il ne révélera pas spontanément>", "...", "..."],
  "kpis_to_probe": ["<2-3 KPI/métriques que ce prospect surveille (ex: coût d'acquisition, taux de remplissage)>", "...", "..."],
  "available_objections": ["<5-7 objections concrètes que ce prospect va sortir, formulées comme à l'oral>", "...", "..."],
  "decision_criteria": "<1-2 phrases : ce qui le ferait dire OUI à un RDV, basé sur ses douleurs réelles>",
  "voice_notes": "<1 phrase sur son style de parole : tutoiement/vouvoiement, vocabulaire, rythme>"
}`;

export async function generateScenario(args: {
  client: Client;
  difficulty: Difficulty;
  gender: Gender;
  personaLabel: string;
}): Promise<Scenario> {
  const { client, difficulty, gender, personaLabel } = args;

  const docs = client.synced_content
    ? truncate(client.synced_content, 50000)
    : `[Aucun document client n'a été uploadé. Génère un scénario cohérent à partir des champs structurés du client.]`;

  const objections = (client.typical_objections ?? []).join("\n- ");

  const system = `Tu es coach commercial senior chez Noxias, agence de prospection externalisée. Tu génères des scénarios de jeu de rôle réalistes pour entraîner les commerciaux Noxias.

Ton job : à partir des docs d'un client (matrice de prospection + boîte à outils) et des paramètres choisis (persona à jouer, difficulté, genre), tu produis un SCÉNARIO précis : qui est le prospect, son contexte, ses douleurs cachées, les objections qu'il va sortir, ce qui le ferait dire oui.

Règles :
- Réponds UNIQUEMENT en JSON valide, pas de markdown, pas de texte avant/après.
- Schéma EXACT :

${SCHEMA}

- Cohérence avec les docs du client : utilise les douleurs, KPI, objections qui y figurent.
- Variété : invente un nom et un contexte d'entreprise différents à chaque appel (pas toujours le même Maître Dupont).
- Réalisme : les détails (taille, ville, secteur) doivent être plausibles et compatibles avec la cible décrite dans la matrice.
- Adapté à la difficulté :
  * débutant : prospect plutôt ouvert, peu d'objections, douleur évidente
  * intermédiaire : 2-3 objections classiques, prospect occupé
  * avancé : prospect sceptique, multi-objections, souvent déjà servi par un concurrent
  * expert : prospect hostile, sur ses gardes, défis à chaque échange
- Adapté au genre : nom et style cohérents (homme ou femme).`;

  const user = `# CLIENT NOXIAS
Nom : ${client.name}
Secteur : ${client.sector ?? "n/a"}
Pitch porté par les commerciaux : ${client.product_pitch}
Value prop : ${client.value_proposition ?? "n/a"}
Cibles idéales : ${client.ideal_targets ?? "n/a"}

Objections classiques connues :
- ${objections || "(aucune renseignée — déduis-les des docs)"}

# DOCS DU CLIENT (matrice + boîte à outils)
${docs}

# PARAMÈTRES DE LA SESSION
Persona à jouer : ${personaLabel}
Difficulté : ${difficulty}
Genre : ${gender}

# TA TÂCHE
Génère le scénario JSON pour cette session. Réponds en JSON pur.`;

  const response = await getAnthropic().messages.create({
    model: SCENARIO_MODEL,
    max_tokens: 2500,
    system,
    messages: [{ role: "user", content: user }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Génération de scénario vide");
  }

  const cleaned = block.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: Scenario;
  try {
    parsed = JSON.parse(cleaned) as Scenario;
  } catch (err) {
    throw new Error(
      `Impossible de parser le scénario : ${(err as Error).message}\n---\n${cleaned.slice(0, 500)}`,
    );
  }

  return parsed;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}\n\n[... contenu tronqué ...]` : s;
}
