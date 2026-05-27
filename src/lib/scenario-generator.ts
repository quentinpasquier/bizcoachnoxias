import { getAnthropic } from "./anthropic";
import type {
  Client,
  Difficulty,
  Gender,
  PersonaProfile,
  Scenario,
} from "./supabase/types";

const SCENARIO_MODEL = "claude-sonnet-4-6";

// =====================================================================
// DIVERSITY POOLS : utilisés pour casser le mode collapse de Claude.
// À chaque génération, on tire au sort 1 élément par dimension pour le
// pré-cabler dans le prompt. Sans ce mécanisme, Claude retombe sur ses
// patterns favoris (Pierre Martin DAF d'une PME lyonnaise, etc.).
// =====================================================================

const FRENCH_FIRST_NAMES_HOMME = [
  "Antoine", "Arnaud", "Baptiste", "Benjamin", "Benoît", "Bertrand", "Bruno",
  "Cédric", "Christophe", "Damien", "David", "Édouard", "Emmanuel", "Étienne",
  "Fabien", "Fabrice", "Florent", "Franck", "François", "Frédéric", "Gaël",
  "Gauthier", "Gilles", "Grégoire", "Grégory", "Guillaume", "Hervé", "Hugo",
  "Ismaël", "Jean-Baptiste", "Jean-Marc", "Jérémy", "Jérôme", "Joël", "Julien",
  "Karim", "Kévin", "Laurent", "Loïc", "Ludovic", "Marc", "Mathieu", "Mathias",
  "Maxime", "Mehdi", "Mickaël", "Nicolas", "Noé", "Olivier", "Pascal",
  "Patrick", "Pierre-Henri", "Quentin", "Raphaël", "Régis", "Rémi", "Renaud",
  "Romain", "Samuel", "Sébastien", "Serge", "Stéphane", "Sylvain", "Thierry",
  "Thibault", "Tristan", "Vincent", "Xavier", "Yann", "Yannick",
];

const FRENCH_FIRST_NAMES_FEMME = [
  "Adeline", "Agnès", "Alexandra", "Alice", "Aline", "Amandine", "Anaïs",
  "Anne-Laure", "Anne-Sophie", "Audrey", "Aurélie", "Béatrice", "Camille",
  "Caroline", "Catherine", "Cécile", "Céline", "Charlotte", "Chloé",
  "Christelle", "Christine", "Claire", "Clémence", "Coralie", "Delphine",
  "Diane", "Élise", "Élodie", "Emma", "Emmanuelle", "Estelle", "Eugénie",
  "Fanny", "Fatima", "Florence", "Frédérique", "Géraldine", "Hélène", "Inès",
  "Isabelle", "Jeanne", "Jessica", "Joëlle", "Julie", "Juliette", "Justine",
  "Karine", "Laetitia", "Laure", "Laurence", "Léa", "Léna", "Lise", "Lucie",
  "Mahaut", "Margaux", "Marion", "Mathilde", "Mélanie", "Mélissa", "Mireille",
  "Myriam", "Nadia", "Nathalie", "Noémie", "Ophélie", "Pauline", "Perrine",
  "Sabrina", "Salomé", "Sandrine", "Sarah", "Ségolène", "Solène", "Sonia",
  "Stéphanie", "Sylvie", "Tatiana", "Valérie", "Vanessa", "Véronique",
  "Virginie", "Yasmine", "Zoé",
];

const FAMILY_NAMES = [
  "Adam", "Allard", "André", "Aubert", "Baron", "Barbier", "Barre", "Bauer",
  "Beaulieu", "Bénard", "Berger", "Bernard", "Bertrand", "Bonnet", "Boucher",
  "Boulanger", "Bourgeois", "Boutin", "Boyer", "Brunet", "Caron", "Charpentier",
  "Chevalier", "Clément", "Colin", "Da Silva", "Dauphin", "David", "Denis",
  "Deschamps", "Desjardins", "Dubois", "Duchemin", "Dufour", "Duhamel",
  "Dumas", "Dumont", "Dupont", "Durand", "Faure", "Ferrand", "Fontaine",
  "Fournier", "Gaillard", "Garcia", "Gauthier", "Gérard", "Girard", "Giraud",
  "Gomez", "Guérin", "Guyot", "Henry", "Hubert", "Jacquet", "Lacroix",
  "Lambert", "Lacombe", "Lange", "Laporte", "Laurent", "Le Roux", "Lecomte",
  "Lefèbvre", "Legrand", "Lemaire", "Léonard", "Leroy", "Lévy", "Loiseau",
  "Lopez", "Marchand", "Marie", "Martin", "Mercier", "Meunier", "Michel",
  "Moreau", "Moulin", "Muller", "Nguyen", "Noël", "Pasquier", "Perrin",
  "Petit", "Philippe", "Picard", "Pichon", "Poirier", "Renard", "Rey",
  "Richard", "Robert", "Robin", "Rolland", "Rousseau", "Roussel", "Roy",
  "Sanchez", "Schmitt", "Simon", "Tessier", "Thomas", "Vidal", "Vincent",
];

const FRENCH_LOCATIONS = [
  "Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Nantes", "Strasbourg",
  "Montpellier", "Bordeaux", "Lille", "Rennes", "Reims", "Saint-Étienne",
  "Le Havre", "Toulon", "Grenoble", "Dijon", "Angers", "Nîmes", "Villeurbanne",
  "Aix-en-Provence", "Brest", "Le Mans", "Tours", "Amiens", "Limoges", "Clermont-Ferrand",
  "Besançon", "Metz", "Perpignan", "Orléans", "Caen", "Mulhouse", "Boulogne-Billancourt",
  "Rouen", "Nancy", "Argenteuil", "Annecy", "La Rochelle", "Pau",
  "petite couronne parisienne (Hauts-de-Seine)", "banlieue lyonnaise",
  "Bretagne intérieure", "Aveyron rural", "Vendée littorale", "Alsace transfrontalière",
  "Pays basque", "Cévennes", "Haute-Savoie", "Côte d'Azur arrière-pays",
];

const AGE_BUCKETS = [
  "29-33 ans (junior fraîchement promu, ambitieux, encore tout à prouver)",
  "34-38 ans (jeune manager confirmé, jongle entre opérationnel et stratégie)",
  "39-44 ans (cadre rodé, regard pragmatique, sait quand dire non)",
  "45-50 ans (senior expérimenté, vu beaucoup de coups, peu de patience)",
  "51-57 ans (vieille école, attaché aux fondamentaux, méfiant des modes)",
  "58-63 ans (vue d'ensemble, à 5 ans de la sortie, regarde la transmission)",
];

const PERSONALITY_TRAITS = [
  "cartésien et direct, va droit au but, déteste l'imprécision",
  "chaleureux mais évasif, dit oui pour ne pas dire non",
  "méfiant de nature, scrute le commercial dès la première seconde",
  "blasé, en a vu d'autres, tu dois sortir du lot pour exister",
  "curieux par défaut, ouvert à l'innovation, mais demande des preuves",
  "pragmatique, ne croit qu'aux chiffres et aux cas concrets",
  "stratégique, pose des questions pour te piéger",
  "stressé en permanence, parle vite, finit ses phrases dans sa tête",
  "poli mais ferme, refuse sans hausser le ton",
  "ironique, vanne le commercial pour tester son sang-froid",
  "désabusé, déjà eu trois prestataires identiques qui ont déçu",
  "people-pleaser, aimable au téléphone mais ne tient pas ses engagements",
  "old-school, préfère le présentiel et le téléphone fixe",
  "fier de sa boîte, aime quand on lui dit qu'on connaît son secteur",
  "discret, ne se met pas en avant, valorise uniquement les chiffres",
  "diplomate, jamais frontal mais ferme dans ses non",
  "exigeant et perfectionniste, repère les approximations à la milliseconde",
  "intuitif, décide à l'instinct, demande peu de data",
];

const PHYSICAL_SETTINGS = [
  "au volant entre deux rendez-vous, bruit de circulation en fond",
  "dans son bureau porte fermée, calme total",
  "dans un open-space bruyant, baisse instinctivement la voix",
  "sur un chantier, casque sur la tête, doit crier pour s'entendre",
  "dans le métro, parle à voix basse pour ne pas déranger",
  "dans la salle de pause, café à la main",
  "en télétravail chez lui, son chien aboie au loin",
  "dans la cuisine de son resto en plein coup de feu",
  "en boutique entre deux clients qui attendent",
  "sur le parking de l'aéroport, vient d'atterrir",
  "à la fin d'une réunion qui a débordé, son agenda explose",
  "vient d'arriver au bureau, café pas encore bu, manteau encore sur lui",
  "rentre du déjeuner, légère somnolence post-prandiale",
  "en RDV client extérieur, sort 30 secondes pour répondre",
  "lit un mail urgent quand le téléphone sonne, divisé en deux",
  "dans le hall de son entreprise, en transit",
  "en visio depuis sa cuisine, casque sur les oreilles",
  "dans son atelier, mains encore sales, essuie au tablier",
];

const RECENT_TRIGGERS = [
  "vient de boucler son budget annuel la semaine dernière, esprit dispo",
  "vient d'apprendre une réorg en interne, esprit ailleurs",
  "son CFO a justement demandé un audit des dépenses cette semaine",
  "un de ses concurrents directs vient d'annoncer une levée de fonds",
  "il a viré son dernier prestataire de prospection il y a 6 mois",
  "revient d'un déplacement client à l'étranger, jetlag visible",
  "son N+1 est en arrêt maladie, il porte deux casquettes en ce moment",
  "vient de signer son plus gros deal du trimestre la veille",
  "sujet de tension RH non résolu (départ d'un cadre clé)",
  "audit qualité ISO démarre la semaine prochaine, sous pression",
  "son équipe a raté son objectif Q2, il est sous tension",
  "vient de finir une rénovation complète de son site web, fier",
  "présentation au COMEX dans 3 jours, en mode marathon",
  "dans un projet d'acquisition de société en négos",
  "revient juste de vacances, inbox à 850 mails",
  "rien de particulier, journée banale, esprit dispo",
  "il a perdu un client important la semaine dernière, à vif",
  "son entreprise vient d'être primée à un salon, état d'esprit positif",
  "il vient de licencier un collaborateur ce matin, mal à l'aise",
  "il prépare un déménagement de site dans 2 mois, débordé logistique",
];

const OBJECTION_BIASES = [
  "le PRIX d'abord (trop cher, pas le budget cette année)",
  "le TEMPS d'abord (j'ai pas le temps, rappelez plus tard)",
  "le BESOIN d'abord (on n'en a pas besoin, on est équipés)",
  "la CONCURRENCE d'abord (on a déjà un prestataire, depuis longtemps)",
  "la CONFIANCE d'abord (je ne vous connais pas, jamais entendu parler)",
  "la DÉCISION d'abord (ce n'est pas moi qui décide / pas mon scope)",
  "l'EXPÉRIENCE PASSÉE (on a déjà essayé ça, n'a pas marché)",
  "la PRIORITÉ (ce n'est pas dans mes 3 priorités cette année)",
  "le DOUTE SUR L'EFFICACITÉ (ça ne marche pas dans notre métier)",
  "l'INTERNE (on a une équipe interne, pas besoin d'externalisation)",
];

// Styles de parole calibrés pour rester PROFESSIONNELS quoi qu'il arrive.
// Tous ces styles vouvoient le commercial et utilisent des marques d'oralité
// sobres ("écoutez", "voyez", "bon", "alors") plutôt que familières
// ("ah ouais", "ben", "tu vois", "franchement"). Le ton sympathique reste
// possible (cabinet, indépendant) mais jamais relâché.
const SPEECH_STYLES = [
  "ton sec et minéral, phrases courtes, pas d'enrobage, fréquence des 'écoutez', 'voyez'",
  "ton mesuré mais évasif, 'on verra', 'pourquoi pas', 'je vous reviens là-dessus'",
  "ton accessible et chaleureux (typique TPE / cabinet) : marques d'oralité sobres comme 'écoutez', 'bon', 'd'accord', sans jamais tomber dans le familier",
  "ton corporate, vocabulaire grand groupe (indicateurs, méthodes, sponsors, instances), articulation soignée",
  "ton terrain professionnel : vocabulaire métier précis (atelier, chantier, production) sans relâchement de langage",
  "ton hésitant mesuré : 'alors...', 'voyons...', 'attendez un instant', jamais des chapelets de 'euh'",
  "ton percutant, phrases bouclées, professionnel rodé media-trained",
  "ton un peu désabusé mais articulé, avec des silences travaillés et des soupirs sobres",
  "ton enthousiaste de façade ('très intéressant', 'je note'), sans engagement réel",
  "ton de cadre supérieur poli qui s'interroge sur la pertinence de l'appel",
  "ton direct et tranchant ('Quel est l'objet précis de votre appel ?'), poli mais sans complaisance",
  "ton chaleureux avec très léger accent régional (Sud-Ouest, Marseille, Nord), reste pro",
  "ton mesuré et juridique, comme un notaire ou DAF : tournures précises, vocabulaire technique",
];

const COMPANY_SIZE_BUCKETS = [
  "TPE de 3-12 salariés, dirigeant fait tout",
  "PME de 15-40 personnes, structure légère, 1 manager par fonction",
  "PME de 50-100 personnes, début de structuration RH/finance",
  "ETI de 120-300 personnes, hiérarchie claire, processus formels",
  "ETI de 350-800 personnes, multi-sites, COMEX en place",
  "filiale française d'un groupe international (1000+ personnes)",
  "réseau de franchises, gérant indépendant local",
  "cabinet/agence/étude de 5-25 collaborateurs, structure horizontale",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function buildDiversitySeed(gender: Gender): string {
  const firstNamePool =
    gender === "femme" ? FRENCH_FIRST_NAMES_FEMME : FRENCH_FIRST_NAMES_HOMME;
  const firstName = pickRandom(firstNamePool);
  const familyName = pickRandom(FAMILY_NAMES);
  const location = pickRandom(FRENCH_LOCATIONS);
  const age = pickRandom(AGE_BUCKETS);
  const personality = pickRandom(PERSONALITY_TRAITS);
  const setting = pickRandom(PHYSICAL_SETTINGS);
  const trigger = pickRandom(RECENT_TRIGGERS);
  const objectionBias = pickRandom(OBJECTION_BIASES);
  const speechStyle = pickRandom(SPEECH_STYLES);
  const companySize = pickRandom(COMPANY_SIZE_BUCKETS);

  return `# AXES DE DIVERSITÉ : utilise CES éléments précis pour générer le scénario

Pour éviter le mode collapse (toujours Pierre Martin DAF d'une PME lyonnaise), 10 dimensions ont été pré-tirées au sort pour CETTE session. Tu DOIS les intégrer.

1. PRÉNOM CIBLE : ${firstName} (utilise-le tel quel, ou un proche immédiat. JAMAIS Pierre, Marie, Jean, Sophie, Thomas, Laure, Nicolas qui sont saturés)
2. NOM DE FAMILLE CIBLE : ${familyName}
3. LIEU : ${location}
4. TRANCHE D'ÂGE : ${age}
5. TRAIT DE PERSONNALITÉ DOMINANT : ${personality}
6. SETTING PHYSIQUE AU DÉCROCHAGE (à reporter dans current_setting) : ${setting}
7. ÉLÉMENT DÉCLENCHEUR RÉCENT (à intégrer dans current_situation) : ${trigger}
8. BIAIS D'OBJECTION PRIORITAIRE (le prospect dégaine CETTE objection en premier) : ${objectionBias}
9. STYLE DE PAROLE (à reporter dans voice_notes et speech_quirks) : ${speechStyle}
10. TAILLE D'ENTREPRISE : ${companySize}

Respecte CES éléments. Adapte persona_name, company_name, company_context, current_situation, current_setting, mood_baseline, available_objections, speech_quirks et voice_notes en conséquence. Les pains_points / KPIs / objections peuvent être ajustés pour coller à la taille et au lieu.`;
}

function buildRecentScenariosBlock(
  recentScenarios: { persona_name: string; persona_role: string; company_name: string }[],
): string {
  if (recentScenarios.length === 0) return "";
  const lines = recentScenarios
    .map(
      (s, i) =>
        `${i + 1}. ${s.persona_name} (${s.persona_role}) chez ${s.company_name}`,
    )
    .join("\n");
  return `\n# SCÉNARIOS DÉJÀ JOUÉS RÉCEMMENT (à éviter)

Voici les ${recentScenarios.length} dernier(s) scénario(s) joué(s) par ce commercial sur ce client. INTERDICTION d'utiliser les mêmes prénoms, noms, ou noms d'entreprises. Varie franchement :

${lines}
`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}\n\n[... contenu tronqué ...]` : s;
}

export async function generateScenario(args: {
  client: Client;
  difficulty: Difficulty;
  gender: Gender;
  personaLabel: string;
  recentScenarios?: { persona_name: string; persona_role: string; company_name: string }[];
}): Promise<Scenario> {
  const { client, difficulty, gender, personaLabel, recentScenarios = [] } = args;

  const profile = (client.persona_profiles ?? []).find(
    (p: PersonaProfile) => p.label === personaLabel,
  );

  const docs = client.synced_content
    ? truncate(client.synced_content, 50000)
    : `[Aucun document client n'a été uploadé. Génère un scénario cohérent à partir des champs structurés.]`;

  const objections = (client.typical_objections ?? []).join("\n- ");

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

Tu DOIS coller à ce profil sur le FOND (douleurs, KPIs, signaux de décision). Le scénario que tu génères doit hériter de ces caractéristiques tout en variant RADICALEMENT les détails (nom, ville, situation actuelle, style de parole). Voir AXES DE DIVERSITÉ ci-dessous.
`
    : "";

  const diversitySeed = buildDiversitySeed(gender);
  const recentBlock = buildRecentScenariosBlock(recentScenarios);

  const system = `Tu es coach commercial senior chez Noxias, agence de prospection externalisée. Tu génères des scénarios de jeu de rôle réalistes pour entraîner les commerciaux Noxias.

Règles :
- Réponds UNIQUEMENT en JSON valide, pas de markdown, pas de texte avant/après.
- Schéma EXACT :

${SCHEMA}

- Cohérence avec le profil et les docs : utilise les douleurs, KPI, objections du persona.
- DIVERSITÉ MAXIMALE : utilise les AXES DE DIVERSITÉ ci-dessous tels qu'ils sont pré-tirés. NE PAS retomber sur les patterns par défaut (Pierre Martin DAF lyonnais, Sophie Bernard DRH PME parisienne...).
- Réalisme : détails plausibles et compatibles avec la cible.
- Adapté à la difficulté : débutant = ouvert | intermédiaire = 2-3 objections | avancé = sceptique multi-objections | expert = hostile, défis à chaque échange.
- Adapté au genre : nom et style cohérents.

# RÈGLES D'AUTHENTICITÉ ORALE (crucial pour l'immersion)
- Les available_objections doivent être formulées EXACTEMENT comme un dirigeant les dirait à l'oral, en 1ère personne, courtes (1 phrase max), TOUJOURS en VOUVOIANT le commercial. Pas de "le prospect dira que...", écris la phrase brute. Ex : "Écoutez, je vais être franc avec vous, ce n'est pas le moment."
- Les speech_quirks doivent être des tics RÉELS du persona, observables à chaque réplique, et SOBRES (registre professionnel). Pas "il utilise des anglicismes" mais "dit 'effectivement' à chaque acquittement" ou "termine ses phrases par 'voilà'". INTERDITS dans les tics : "ah ouais", "ben", "et ben", "carrément", "trop", "ouf", "tu vois en chapelet".
- TON adapté à la TAILLE de l'entreprise du persona :
  • TPE / cabinet / indépendant : ton accessible et chaleureux possible, vocabulaire courant, peu de jargon. JAMAIS familier au point de "ah ouais".
  • PME / ETI / filiale de grand groupe : ton corporate, méthodique, vocabulaire métier précis, phrases construites.
  Dans tous les cas : VOUVOIEMENT strict du commercial.
- Le voice_notes doit donner une vraie texture vocale (rapidité, accent régional éventuel, niveau d'énergie).`;

  const user = `# CLIENT NOXIAS
Nom : ${client.name}
Secteur : ${client.sector ?? "n/a"}
Pitch porté par les commerciaux : ${client.product_pitch}
Value prop : ${client.value_proposition ?? "n/a"}
Cibles idéales : ${client.ideal_targets ?? "n/a"}

Objections classiques connues :
- ${objections || "(aucune renseignée. déduis-les des docs)"}

${profileBlock}

${diversitySeed}
${recentBlock}

# DOCS DU CLIENT (matrice + boîte à outils)
${docs}

# PARAMÈTRES DE LA SESSION
Persona à jouer : ${personaLabel}
Difficulté : ${difficulty}
Genre : ${gender}

# TA TÂCHE
Génère le scénario JSON pour cette session, en RESPECTANT les AXES DE DIVERSITÉ (point n°1 ABSOLU) et en évitant les scénarios récents listés. Réponds en JSON pur.`;

  const response = await getAnthropic().messages.create({
    model: SCENARIO_MODEL,
    max_tokens: 2500,
    // Température max pour maximiser la variété. Combiné avec les AXES DE
    // DIVERSITÉ pré-tirés, ça casse efficacement le mode collapse.
    temperature: 1.0,
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

const SCHEMA = `{
  "persona_label": "<étiquette générique du persona joué>",
  "persona_name": "<prénom + nom français crédible, cohérent avec le genre>",
  "persona_role": "<intitulé exact du poste>",
  "company_name": "<nom de l'entreprise/cabinet/établissement, fictif mais crédible (jamais d'enseigne réelle)>",
  "company_context": "<2-3 phrases : taille, ville, secteur, particularités>",
  "current_situation": "<2-3 phrases : ce que vit le prospect en ce moment, déclencheurs potentiels>",
  "current_setting": "<1 phrase concrète : où il est physiquement quand il décroche (au volant, dans son bureau porte ouverte, en cuisine de son restaurant, au bord du chantier, en pause cigarette, dans le métro, etc.). Ça influence sa disponibilité et son ton.>",
  "mood_baseline": "<1 phrase : son humeur de base au décrochage (agacé d'être dérangé, neutre, pressé, curieux par défaut...). Cette humeur évoluera SELON ce que dit le commercial.>",
  "hidden_pain_points": ["<3 douleurs spécifiques qu'il ne révélera pas spontanément>", "...", "..."],
  "kpis_to_probe": ["<2-3 KPI/métriques que ce prospect surveille>", "...", "..."],
  "available_objections": ["<5-7 objections concrètes formulées comme à l'oral, en 1ère personne, COURTES (1 phrase max)>", "...", "..."],
  "speech_quirks": ["<3-4 tics de langage PROFESSIONNELS et SOBRES, à utiliser parcimonieusement : ex 'écoutez', 'voyez', 'effectivement', 'd'accord', 'tout à fait', 'je vous l'accorde', 'pour être franc', 'concrètement'. PAS de 'ah ouais', 'ben', 'et ben', 'tu vois', 'franchement' en chapelet. Le prospect est un adulte au travail.>", "...", "..."],
  "decision_criteria": "<1-2 phrases : ce qui le ferait dire OUI à un RDV>",
  "voice_notes": "<2-3 phrases : VOUVOIEMENT obligatoire (jamais 'tu'). Niveau de vocabulaire (courant pour TPE/indépendant, technique métier pour PME/ETI/grand groupe), rythme (rapide/posé), niveau d'énergie, accent ou région éventuels. Le ton reste TOUJOURS professionnel quelle que soit la taille de l'entreprise.>"
}`;
