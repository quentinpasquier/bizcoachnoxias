import { getAnthropic } from "./anthropic";
import type {
  Client,
  Difficulty,
  Gender,
  PersonaProfile,
  Scenario,
} from "./supabase/types";

const SCENARIO_MODEL = "claude-sonnet-4-6";

const SCHEMA = `{
  "persona_label": "<étiquette générique du persona joué>",
  "persona_name": "<prénom + nom français crédible, cohérent avec le genre>",
  "persona_role": "<intitulé exact du poste>",
  "company_name": "<nom de l'entreprise/cabinet/établissement, fictif mais crédible>",
  "company_context": "<2-3 phrases : taille, ville, secteur, particularités>",
  "current_situation": "<2-3 phrases : ce que vit le prospect en ce moment, déclencheurs potentiels>",
  "hidden_pain_points": ["<3 douleurs spécifiques qu'il ne révélera pas spontanément>", "...", "..."],
  "kpis_to_probe": ["<2-3 KPI/métriques que ce prospect surveille>", "...", "..."],
  "available_objections": ["<5-7 objections concrètes formulées comme à l'oral>", "...", "..."],
  "decision_criteria": "<1-2 phrases : ce qui le ferait dire OUI à un RDV>",
  "voice_notes": "<1 phrase sur son style de parole : tutoiement/vouvoiement, vocabulaire, rythme>"
}`;

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}\n\n[... contenu tronqué ...]` : s;
}

export async function generateScenario(args: {
  client: Client;
  difficulty: Difficulty;
  gender: Gender;
  personaLabel: string;
}): Promise<Scenario> {
  const { client, difficulty, gender, personaLabel } = args;

  const profile = (client.persona_profiles ?? []).find(
    (p: PersonaProfile) => p.label === personaLabel,
  );

  const docs = client.synced_content
    ? truncate(client.synced_content, 50000)
    : `[Aucun document client n'a été uploadé. Génère un scénario cohérent à partir des champs structurés.]`;

  const objections = (client.typical_objections ?? []).join("\n- ");

  // Brief enrichi du persona si profile disponible
  const profileBlock = profile
    ? `
# PROFIL DU PERSONA À JOUER (déjà préparé pour ce client)
- Label : ${profile.label}
- Rôle exact : ${profile.role}
- Entreprise typique : ${profile.typical_company}
- Douleurs clés : ${profile.key_pains.join(" ; ")}
- KPIs surveillés : ${profile.key_kpis.join(" ; ")}
- Objections principales attendues : ${profile.main_objections.map((o) => `« ${o} »`).join(" ; ")}
- Ce qui le fait dire OUI : ${profile.decision_signals}

Brief de préparation (déjà rédigé) :
${profile.prep_briefing}

Tu DOIS coller à ce profil. Le scénario que tu génères doit hériter de ces caractéristiques tout en variant les détails (nom, ville, situation actuelle).
`
    : "";

  const system = `Tu es coach commercial senior chez Noxias, agence de prospection externalisée. Tu génères des scénarios de jeu de rôle réalistes pour entraîner les commerciaux Noxias.

Règles :
- Réponds UNIQUEMENT en JSON valide, pas de markdown, pas de texte avant/après.
- Schéma EXACT :

${SCHEMA}

- Cohérence avec le profil et les docs : utilise les douleurs, KPI, objections du persona.
- Variété : invente un nom, une entreprise, une situation différents à chaque appel.
- Réalisme : détails plausibles et compatibles avec la cible.
- Adapté à la difficulté : débutant = ouvert | intermédiaire = 2-3 objections | avancé = sceptique multi-objections | expert = hostile, défis à chaque échange.
- Adapté au genre : nom et style cohérents.`;

  const user = `# CLIENT NOXIAS
Nom : ${client.name}
Secteur : ${client.sector ?? "n/a"}
Pitch porté par les commerciaux : ${client.product_pitch}
Value prop : ${client.value_proposition ?? "n/a"}
Cibles idéales : ${client.ideal_targets ?? "n/a"}

Objections classiques connues :
- ${objections || "(aucune renseignée — déduis-les des docs)"}

${profileBlock}

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
