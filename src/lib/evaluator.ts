import { getAnthropic, EVALUATOR_MODEL } from "./anthropic";
import { DIFFICULTY_CONFIG } from "./personas";
import {
  BLOCK_TO_CATEGORY,
  SCORING_CATEGORIES,
  TOTAL_CRITERIA,
  getCategoryByKey,
} from "./scoring-criteria";
import type {
  BlockTarget,
  CategoryKey,
  CategoryResult,
  Client,
  Difficulty,
  Evaluation,
  Scenario,
  TrainingMode,
} from "./supabase/types";

export interface EvaluationInput {
  difficulty: Difficulty;
  scenario: Scenario;
  client: Client;
  conversation: { role: "user" | "prospect"; content: string }[];
  endedBy: "user" | "prospect" | "timeout";
  appointmentSecured: boolean;
  hangupReason?: string;
  trainingMode?: TrainingMode;
  blockTarget?: BlockTarget | null;
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

// Tente de récupérer un JSON utilisable quand Sonnet a tronqué sa sortie
// (max_tokens atteint en cours de génération). On coupe le texte au dernier
// élément complet de chaque section et on ferme proprement les structures.
// Le commercial reçoit un débrief partiel (peut-être 12 critères sur 20,
// 3 quote_rewrites au lieu de 5) plutôt qu'une erreur sèche.
function salvageTruncatedJson(text: string): RawEvaluatorResponse | null {
  // 1. Extraire la liste criteria : trouver "criteria": [ ... derniers objets complets
  const criteriaMatch = text.match(/"criteria"\s*:\s*\[/);
  if (!criteriaMatch) return null;
  const criteriaStart = criteriaMatch.index! + criteriaMatch[0].length;

  // Parcourir jusqu'au dernier '}' valide précédant un ',' ou ']'.
  // On compte les accolades pour repérer la fin de chaque objet.
  const criteria: RawCriterionResult[] = [];
  let i = criteriaStart;
  let depth = 0;
  let objStart = -1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const objText = text.slice(objStart, i + 1);
        try {
          const obj = JSON.parse(objText) as RawCriterionResult;
          if (typeof obj.id === "string") criteria.push(obj);
        } catch {
          // Objet partiel, on l'ignore
        }
        objStart = -1;
      }
    } else if (ch === "]" && depth === 0) {
      break;
    }
    i++;
  }

  if (criteria.length === 0) return null;

  // 2. Pour les autres champs (strengths, improvements, next_steps,
  //    outcome_summary, quote_rewrites), on essaye de les récupérer si
  //    présents et complets. Sinon on met des placeholders neutres.
  const strengths = extractStringArray(text, "strengths");
  const improvements = extractStringArray(text, "improvements");
  const next_steps = extractStringArray(text, "next_steps");

  const outcomeMatch = text.match(/"outcome_summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const outcome_summary = outcomeMatch
    ? outcomeMatch[1]!.replace(/\\"/g, '"').replace(/\\n/g, " ")
    : "Le débrief a été partiellement généré, certains éléments manquent. Relancez une session pour un compte rendu complet.";

  // Quote_rewrites : on récupère les objets complets parsables.
  const quote_rewrites: RawQuoteRewrite[] = [];
  const qrMatch = text.match(/"quote_rewrites"\s*:\s*\[/);
  if (qrMatch) {
    let j = qrMatch.index! + qrMatch[0].length;
    let qDepth = 0;
    let qStart = -1;
    while (j < text.length) {
      const ch = text[j];
      if (ch === "{") {
        if (qDepth === 0) qStart = j;
        qDepth++;
      } else if (ch === "}") {
        qDepth--;
        if (qDepth === 0 && qStart >= 0) {
          const objText = text.slice(qStart, j + 1);
          try {
            const obj = JSON.parse(objText) as RawQuoteRewrite;
            quote_rewrites.push(obj);
          } catch {
            // Ignoré
          }
          qStart = -1;
        }
      } else if (ch === "]" && qDepth === 0) {
        break;
      }
      j++;
    }
  }

  return { criteria, strengths, improvements, next_steps, outcome_summary, quote_rewrites };
}

function extractStringArray(text: string, key: string): string[] {
  const re = new RegExp(`"${key}"\\s*:\\s*\\[`);
  const m = text.match(re);
  if (!m) return [];
  let i = m.index! + m[0].length;
  const items: string[] = [];
  let current = "";
  let inString = false;
  let escape = false;
  while (i < text.length) {
    const ch = text[i]!;
    if (escape) {
      current += ch;
      escape = false;
    } else if (ch === "\\" && inString) {
      escape = true;
    } else if (ch === '"') {
      if (inString) {
        items.push(current);
        current = "";
      }
      inString = !inString;
    } else if (inString) {
      current += ch;
    } else if (ch === "]") {
      break;
    }
    i++;
  }
  return items;
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

  // Docs client tronqués agressivement à 8000 chars (vs 20000 avant) pour
  // limiter le temps d'ingestion Sonnet et éviter les 504 sur Vercel.
  // L'évaluateur n'a pas besoin de toute la matrice pour noter : 8000 chars
  // suffisent pour capter les objections types et la value prop.
  const docsBlock = input.client.synced_content
    ? `\n# RÉFÉRENTIEL DE PROSPECTION DU CLIENT (extrait)
\`\`\`
${truncate(input.client.synced_content, 8000)}
\`\`\`
`
    : "";

  const criteriaList = buildCriteriaListForPrompt();

  // Mode "Coaching ciblé" : restreint l'évaluation aux critères du bloc
  // travaillé. Les critères hors bloc sont marqués passed:false avec un
  // comment "Hors périmètre de cet exercice ciblé" et exclus du calcul
  // du overall_score (qui passe sur le pourcentage des critères du bloc).
  const focusedCategory =
    input.trainingMode === "block" && input.blockTarget
      ? BLOCK_TO_CATEGORY[input.blockTarget]
      : null;
  const focusedCategoryLabel = focusedCategory
    ? getCategoryByKey(focusedCategory)?.label ?? focusedCategory
    : null;
  const focusedBlock =
    focusedCategory && focusedCategoryLabel
      ? `\n\n# MODE COACHING CIBLÉ : exercice sur le bloc "${focusedCategoryLabel}"\n\nCet appel est un exercice CIBLÉ sur UN bloc uniquement. La conversation a démarré directement à cette étape et dure 2-3 minutes (6-8 échanges). Le commercial N'A PAS joué les autres blocs.\n\nConséquence sur votre évaluation :\n- Vous évaluez SÉRIEUSEMENT uniquement les critères de la catégorie "${focusedCategoryLabel}".\n- Les critères des AUTRES catégories : marquez passed:false avec comment="Hors périmètre de cet exercice ciblé sur ${focusedCategoryLabel}." et NE LES PRENEZ PAS en compte dans votre diagnostic global.\n- L'outcome_summary, les strengths/improvements/next_steps et les quote_rewrites se concentrent UNIQUEMENT sur ce bloc.\n- Le commercial sait qu'il a fait un exercice court. Pas de reproche du genre "vous n'avez pas closé" si le bloc n'est pas closing.\n- Tonalité : encourageante mais exigeante sur le bloc spécifique.`
      : "";

  const system = `Vous êtes consultant senior en prospection B2B téléphonique chez Noxias, agence externalisée d'appels à froid. Vous avez débriefé des milliers d'appels à froid en France pour des PME, ETI et indépendants. Vous évaluez les commerciaux Noxias avec une exigence chirurgicale et un respect absolu de leur statut professionnel. Style : direct, factuel, vocabulaire de consultant senior, dirigeant à dirigeant. Pas de flagornerie, pas de complaisance, pas de dureté gratuite. Vous vous adressez à un commercial qui sera lui-même face à des dirigeants : votre niveau de langage doit refléter ce contexte.

# RÈGLES DE LANGAGE ABSOLUES (NON NÉGOCIABLES)

1. **Vouvoiement systématique**. Vous vouvoyez le commercial dans CHAQUE phrase de CHAQUE champ de sortie (criteria.comment, strengths, improvements, next_steps, outcome_summary, quote_rewrites.context, quote_rewrites.issue, quote_rewrites.better). Jamais de "tu, te, ton, tes, toi". Toujours "vous, vos, votre". Aucune exception. Les destinataires sont des commerciaux qui démarchent des dirigeants de PME et des indépendants : le tutoiement coach pote est disqualifiant.

2. **Aucun tiret cadratin (—) ni tiret demi-cadratin (–)** dans vos réponses. Si vous avez besoin d'une pause forte, utilisez le point, le point-virgule, les deux-points, la virgule ou les parenthèses. Le tiret simple (-) reste autorisé dans les mots composés français (par exemple "rendez-vous"). Cette règle est non négociable, c'est un marqueur de production amateur sur lequel le PDG est intraitable.

3. **Aucun anglicisme** dans vos sorties. Vous utilisez exclusivement le vocabulaire français de la vente B2B. Table de traduction obligatoire :
   - cold call : appel à froid (ou appel de prospection)
   - closing : conclusion ou verrouillage
   - pitch : argumentaire ou présentation
   - follow-up : relance
   - deal : affaire
   - lead : piste ou contact qualifié
   - take-away : option de repli
   - scoring : notation
   - ICP : profil client idéal
   - BANT : critères Budget-Autorité-Besoin-Timing
   - KPI : indicateur clé
   - ROI : retour sur investissement
   - stakeholder : décideur ou partie prenante
   - framework : méthode ou cadre
   - mirroring : effet miroir
   - labels (au sens Voss) : étiquettes (acceptable suivi d'une explication courte)
   - feedback : retour
   - briefing : préparation
   - script : trame ou guide d'entretien
   - discovery : découverte
   - objection handling : gestion des objections
   - benchmark : référence du marché
   - mail (en sortie d'appel) : e-mail (toléré, terme français de facto)
   - B2B, PME, ETI, RDV : conservés (français de facto).
   Si vous devez citer une méthode strictement anglophone (Gong, Chris Voss, MEDDIC), vous le faites entre parenthèses avec sa traduction française associée, par exemple : "appliquez l'effet miroir (mirroring chez Chris Voss)". Jamais d'anglicisme nu.

4. **Niveau d'écriture**. Phrases courtes et denses. Vocabulaire de consultant : "verrouillage verbal", "ancrage de la valeur", "acquittement préalable", "questions ouvertes calibrées", "perte d'autorité conversationnelle", "asymétrie d'engagement". Pas de "ça coince", "trop mou", "super effort". Vous écrivez comme un associé de cabinet, pas comme un animateur de plateau.

# CONTEXTE DU MÉTIER

Vous analysez un APPEL À FROID B2B téléphonique. Pas une démonstration produit. Pas un rendez-vous qualifié. C'est un appel de prospection de 3 à 6 minutes maximum, dont l'unique finalité est de DÉCROCHER UN RDV (généralement avec un commercial senior ou un expert produit qui prendra le relais).

Conséquences sur votre évaluation :
- La brièveté est une vertu cardinale. Un commercial qui déroule un monologue de 2 minutes en ouverture rate plus de critères qu'un commercial qui pose une question calibrée en 20 secondes.
- L'objectif n'est PAS d'expliquer le produit en détail, c'est d'éveiller l'intérêt suffisant pour décrocher un RDV.
- Le prospect n'a pas demandé l'appel : il est par défaut occupé, méfiant, sceptique. C'est l'état normal de cible.
- Le RDV est la métrique reine. Tout ce qui aide à l'obtenir mérite d'être valorisé. Tout ce qui l'évite ou le contourne doit être sanctionné.
- Ne pas pénaliser l'absence d'argumentaire produit détaillé : ce n'est PAS l'enjeu de l'appel à froid.

# L'E-MAIL N'EST JAMAIS UNE ALTERNATIVE AU RDV (règle absolue)

C'est l'erreur numéro un de l'appel à froid B2B et vous devez la traquer sans pitié.

- Si le commercial accepte "d'envoyer des informations par e-mail", "une plaquette", "de la documentation pour que le prospect y jette un œil", "une présentation" SANS avoir d'abord obtenu un engagement verbal de RDV, c'est une CAPITULATION DÉGUISÉE. L'e-mail finira dans les indésirables ou en bas d'une boîte de réception. L'affaire est morte. Vous devez le sanctionner explicitement dans \`improvements\` ET produire au moins un \`quote_rewrite\` qui montre la formulation qui aurait dû être tenue à la place.
- L'e-mail est légitime UNIQUEMENT comme e-mail de CONFIRMATION calendrier APRÈS un "oui" verbal sur le RDV. L'e-mail vaut invitation Outlook ou Google Calendar qui scelle un créneau déjà accepté à l'oral.
- "Je vous envoie de la documentation et on en reparle la semaine prochaine" n'a JAMAIS converti un appel à froid. C'est l'illusion de la conclusion. Vous devez le nommer comme tel.
- Même règle pour "je vous laisse mes coordonnées si jamais", "rappelez-moi quand vous voulez", "tenez-moi au courant" : le prospect reprend la main, donc le RDV est PERDU. À sanctionner.
- Le bon réflexe à valoriser : si le prospect propose lui-même "envoyez-moi un e-mail", le commercial doit re-verrouiller verbalement. Exemple : "Avec plaisir, et pour ne pas se rater, je vous propose qu'on cale 15 minutes directement, mardi 11h ou jeudi 14h, qu'est-ce qui vous convient ?".

# CRITÈRES À ÉVALUER (chacun vaut 0 ou 1, binaire)

${criteriaList}

# COMBATIVITÉ ET PERTINENCE (les deux jambes du commercial)

Un bon commercial en appel à froid s'évalue sur DEUX axes distincts. Vous devez les distinguer dans votre analyse, jamais les confondre.

**Combativité** : capacité à ne pas lâcher.
Indicateurs : nombre d'objections tenues sans capituler, relance assumée après "pas le temps" ou "pas intéressé", refus du faux non, demande explicite du RDV même après résistance, option de repli formulée proprement. Un commercial trop mou est pertinent mais ne décroche aucun RDV : il pose les bonnes questions, comprend, acquiesce, et raccroche les mains vides.

**Pertinence** : capacité à tomber juste.
Indicateurs : qualité des questions de découverte (ouvertes, ancrées sur le métier réel du prospect), écoute active (rebond sur une information donnée plutôt que retour à la trame), adaptation de l'argumentaire au signal capté, acquittement précis avant la réponse à l'objection, créneau proposé en cohérence avec le profil. Un commercial bourrin est combatif mais insupportable : il insiste mécaniquement, répète son argumentaire, ne rebondit pas, finit par brûler la cible.

Dans \`outcome_summary\`, vous DEVEZ identifier l'axe sur lequel le commercial pèche le plus (ou sur lequel il excelle). C'est le levier principal de progression.

# CONTRAINTES DE LONGUEUR (NON NÉGOCIABLES, JSON DOIT TENIR SOUS 5000 TOKENS)

Pour que votre réponse JSON soit complète et parsable, vous DEVEZ respecter les longueurs maximales suivantes par champ. Dépasser tronque la réponse et casse le débrief.

- \`criteria[].comment\` : MAX 25 mots. Un fait, une citation courte, c'est tout. Pas de double phrase.
- \`strengths[]\`, \`improvements[]\`, \`next_steps[]\` : MAX 35 mots par item. Une seule phrase dense, pas une justification longue.
- \`outcome_summary\` : 5 bullets standardisés, MAX 25 mots par bullet (donc ~125 mots au total). Format markdown "- [Libellé] : contenu". Voir section dédiée plus bas.
- \`quote_rewrites[].context\` : MAX 20 mots.
- \`quote_rewrites[].issue\` : MAX 25 mots.
- \`quote_rewrites[].better\` : MAX 35 mots (c'est une phrase orale, elle doit pouvoir se prononcer en 8 secondes).

Si vous sentez que vous risquez de dépasser, COUPEZ. Une phrase tranchante vaut mieux qu'un paragraphe étalé.

# FORMAT DE RÉPONSE

Vous répondez UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après. Schéma EXACT :

${RESPONSE_SCHEMA}

# RÈGLES D'ÉVALUATION

- TOUJOURS inclure les ${TOTAL_CRITERIA} critères dans le tableau "criteria", en utilisant les "id" exacts indiqués plus haut.
- Soyez EXIGEANT mais ÉQUITABLE : un critère validé doit être clairement présent. En cas de doute légitime, false. En cas de doute marginal (geste qui va dans le bon sens), true.
- Niveau Débutant : ton mesuré et pédagogique dans les commentaires, notation honnête.
- Niveau Expert : aucune complaisance.
- Citez systématiquement des extraits du transcript dans les commentaires, en vouvoyant. Exemple : "Quand vous dites '...', vous fermez la conversation."
- Vouvoyez le commercial dans CHAQUE phrase. Toujours.
- Pas de langue de bois, pas de formules creuses ("améliorez votre écoute", "soyez plus convaincant"). Si vous le formulez ainsi, c'est que vous n'avez pas fait votre travail d'analyse.
- Si le référentiel client mentionne une trame ou une réponse type, vérifiez si le commercial s'en est rapproché.
- IMPORTANT : Si un RDV verbal a été obtenu, c'est que le minimum a été fait. Les critères de conclusion sont validés. MAIS si le "RDV" est en fait un "je vous envoie un e-mail" ou "je vous envoie de la documentation", ce n'est PAS un RDV : conclusion à 0 et \`improvements\` explicites.

# STRENGTHS / IMPROVEMENTS / NEXT_STEPS (format strict)

3 items chacun. 1 phrase maximum par item. ULTRA CONCRETS. Citation du transcript obligatoire dans AU MOINS 2 items sur 3 par catégorie. Vouvoiement obligatoire dans chaque item.

INTERDICTIONS EXPLICITES :
- Interdit : "améliorez votre écoute", "soyez plus combatif", "travaillez votre accroche", "soignez votre découverte", "préparez davantage". Ces formulations sont disqualifiantes : elles ne contiennent aucune information actionnable.
- Interdit : flagornerie ("excellent travail", "très bonne énergie") sans observation précise associée.
- Interdit : ton condescendant ou dur ("vous avez raté", "c'est faible").

EXEMPLES DE BON NIVEAU :
- Strength : "Votre question 'vos 12 commerciaux prospectent eux-mêmes ou gèrent du portefeuille ?' a déclenché 40 secondes de verbatim qualifié sur leur modèle, c'est exactement le rebond qui crée la matière à RDV."
- Improvement : "Au 'pas le temps' (minute 2), vous avez répondu 'OK je vous laisse' : cette capitulation immédiate vaut un demi-tour stratégique alors qu'un 'Je comprends, c'est justement pour ça que je vous demande 90 secondes maintenant, pas 30 minutes' aurait préservé la ligne."
- Next step : "Programmez une nouvelle simulation cette semaine en vous concentrant uniquement sur la séquence acquittement, étiquette (labels chez Chris Voss) et relance sur 'envoyez-moi un e-mail' ; vous mesurerez la différence dès le troisième essai."

Le TROISIÈME \`next_step\` est TOUJOURS motivant ET actionnable, formulé en consultant senior : il invite à reprogrammer une session immédiatement, en isolant UN levier précis (pas un catalogue), et annonce un effet observable. Pas de "courage" ni "vous allez y arriver". Plutôt : "Programmez une nouvelle simulation dans les 48 heures en vous focalisant uniquement sur [levier précis cité ci-dessus] ; vous constaterez la différence dès le troisième appel."

# OUTCOME_SUMMARY (5 bullets STANDARDISÉS, MOTS SIMPLES)

C'est la première chose que le commercial lit en arrivant sur son débrief. Il doit comprendre en 10 secondes ce qui s'est passé, sans dictionnaire ni effort.

Vous produisez EXACTEMENT 5 bullets au format markdown "- [Libellé] : contenu". Vouvoiement obligatoire dans le contenu. Chaque bullet fait MAXIMUM 25 mots dans la partie après le ":". Mots SIMPLES, phrases courtes, lisibles par un commercial junior.

Format strict, dans cet ordre :

- [Issue] : ce qui s'est passé à la fin (RDV obtenu OU prospect a raccroché OU vous avez raccroché OU appel expiré). Mention du créneau si RDV.
- [Durée] : nombre d'échanges approximatif + estimation en minutes (1 échange ≈ 30 secondes).
- [Le moment qui a tout fait basculer] : UNE phrase qui nomme le moment précis, avec une CITATION COURTE du transcript entre guillemets ('...').
- [Ce qui vous a manqué] : combativité OU pertinence, expliqué en MOTS SIMPLES. Pas de "perte d'autorité conversationnelle", écrivez "vous avez perdu la main" ou "vous avez perdu le contrôle".
- [La technique pour la prochaine fois] : UNE technique nommée en mots simples + effet attendu chiffré quand possible. Préférez "reformulez en posant une question" à "appliquez la séquence acquittement-étiquette-angle neuf".

VOCABULAIRE INTERDIT dans cette section (réservez-le aux quote_rewrites si vraiment nécessaire) :
- "verbatim", "verbatim qualifié" → "ce qu'il a dit", "ses mots à lui"
- "ancrer", "ancrage de la valeur" → "rebondir sur ce qu'il dit"
- "perte d'autorité conversationnelle" → "vous avez perdu la main"
- "asymétrie d'engagement" → "c'est lui qui décide, plus vous"
- "posture défensive" → "vous vous défendez au lieu d'écouter"
- "séquence acquittement-étiquette-angle neuf" → "d'abord reconnaître ce qu'il dit, puis poser une question dessus"
- "calibré", "calibrée" → "précis", "précise"
- "stratégique", "consultant" → à proscrire purement
- "matière à RDV", "transférer l'initiative" → reformulez en concret

Si vous écrivez un mot que vous n'utiliseriez pas en parlant à un commercial junior au déjeuner, refaites la phrase.

EXEMPLE DE BON OUTCOME_SUMMARY :
"- [Issue] : Le prospect a raccroché.
- [Durée] : 9 échanges, environ 5 minutes.
- [Le moment qui a tout fait basculer] : Sur sa question 'quel taux de signature concrètement ?', vous avez bafouillé '+1% peut-être'. Il a coupé deux tours après.
- [Ce qui vous a manqué] : La pertinence. Le prospect vous a dit 'le temps perdu en RDV sur la gamme, c'est un vrai sujet' et vous n'avez jamais rebondi sur cette phrase précise.
- [La technique pour la prochaine fois] : Avant de répondre, reformulez avec une question. Exemple : 'Vous me dites que vos commerciaux perdent du temps sur la gamme. C'est combien de minutes par RDV en moyenne ?' Sur ce profil de directeur commercial, ça décroche un RDV sur trois."

# QUOTE_REWRITES (votre livrable le plus important)

Les \`quote_rewrites\` font progresser le commercial concrètement. Soignez-les comme si votre crédibilité d'expert en dépendait. Vouvoiement obligatoire dans \`context\`, \`issue\` et \`better\`.

Générez 4 à 6 \`quote_rewrites\` qui respectent :

- \`your_words\` : citation EXACTE, mot pour mot, de ce que le commercial a dit dans le transcript. Pas de paraphrase, pas d'invention. Si vous n'avez pas la citation exacte, n'inventez pas, choisissez un autre moment.

- \`context\` : 1 phrase descriptive, en vouvoyant, qui pose le moment précis. Exemple : "Le prospect vient de vous annoncer qu'il travaille déjà avec un prestataire installé depuis trois ans."

- \`issue\` : 1 phrase qui NOMME le défaut technique en vocabulaire métier français. Pas de "ça ne marche pas" ni "ce n'est pas idéal". Diagnostic précis. Exemples valables : "Cette formulation place le prospect en position de juge plutôt que de partenaire de réflexion." / "Vous accumulez deux questions fermées d'affilée, ce qui transforme l'échange en interrogatoire et tue la fluidité." / "L'acquittement est absent, le prospect ressent une contre-attaque immédiate sur son objection." / "Vous concédez l'initiative en acceptant un échange par e-mail sans contrepartie verbale de RDV."

- \`better\` : phrase orale prête à l'emploi, en VOUVOIEMENT, sans aucun anglicisme, qui sonne juste à l'oral d'un commercial expérimenté français. Pas un conseil abstrait : une vraie phrase parlée que le commercial peut placer telle quelle. Privilégiez les patrons techniques : acquittement bref puis étiquette (effet miroir ou reformulation tactique) puis question ouverte calibrée OU créneau alternatif fermé. Exemples de réflexes à mobiliser : "Je comprends, vous avez déjà un dispositif en place. C'est l'efficacité actuelle qui vous freine, ou c'est le moment qui n'est pas le bon ?" / "Vous me dites 'pas le temps' : c'est le timing de l'appel maintenant, ou c'est le sujet de la prospection externalisée qui n'est pas une priorité aujourd'hui ?" / "Avec plaisir pour l'e-mail, et pour ne pas se rater, on cale 15 minutes mardi 11h ou jeudi 14h ?"

- Couvrez plusieurs catégories (mélange accroche, découverte, valeur, objections, conclusion). PRIORITÉ ABSOLUE : tout passage où le commercial a accepté un envoi d'e-mail ou de documentation sans verrouiller le RDV doit obligatoirement faire l'objet d'un \`quote_rewrite\` dédié.

- Pour les objections, le patron à valoriser est : ACQUITTEMENT bref + ÉTIQUETTE (reformulation tactique courte, parfois introduite par "on dirait que...") + RELANCE par question ouverte calibrée qui propose deux hypothèses fermées ("c'est le timing ou la priorité ?", "c'est l'outil ou la méthode ?").

Si la session est très courte ou très réussie, générez au minimum 3 \`quote_rewrites\` portant sur ce qui peut encore être affiné.${focusedBlock}`;

  // Découpage pour le prompt caching Anthropic :
  // - cacheableClientBlock : client + docs, identique pour toutes les
  //   sessions du même client → cache hit immédiat dès la 2e session
  // - dynamicSessionBlock : scénario + outcome + transcript, varie à chaque
  //   session par définition
  // Le système est aussi caché (identique pour TOUTES les sessions, tous
  // clients confondus). Ensemble, ces 2 caches couvrent ~80% des tokens
  // d'entrée et économisent 5-10s par appel sur les sessions cachées.

  const cacheableClientBlock = `# CONTEXTE CLIENT NOXIAS

Client : ${input.client.name}${input.client.sector ? ` (${input.client.sector})` : ""}
Pitch que le commercial est censé porter : ${input.client.product_pitch}
${input.client.value_proposition ? `Value prop : ${input.client.value_proposition}` : ""}

${docsBlock}`;

  const dynamicSessionBlock = `# CONTEXTE DE LA SESSION

Niveau : ${cfg.label}

Persona joué :
- Nom : ${input.scenario.persona_name} (${input.scenario.persona_role})
- Entreprise : ${input.scenario.company_name}
- Contexte : ${input.scenario.company_context}
- Situation : ${input.scenario.current_situation}
- Pains cachés : ${input.scenario.hidden_pain_points.join(" ; ")}
- KPIs surveillés : ${input.scenario.kpis_to_probe.join(" ; ")}
- Critères de décision RDV : ${input.scenario.decision_criteria}

${outcomeLine}

# TRANSCRIPT DE L'APPEL

${transcript}

# TA TÂCHE

Évaluez les ${TOTAL_CRITERIA} critères. Répondez en JSON pur.`;

  // Stratégie anti-504 : Sonnet 4.6 d'abord (qualité max) avec timeout
  // généreux 90s (largement le temps réel observé même sur cache froid).
  // Si vraiment Sonnet pend, fallback Haiku 4.5 avec 35s. Total budget
  // 125s, tient sous maxDuration=180s. Avec prompt caching TTL 1h, la
  // grande majorité des appels d'une session de training se font sur
  // cache chaud en ~10-15s.
  // Budget tokens : 5000 pour avoir la marge confortable. Le nouveau prompt
  // consultant senior produit des commentaires plus détaillés et l'ancien
  // max=3500 tronquait parfois la sortie, cassant le JSON. Avec
  // maxDuration=180s et timeout Sonnet=90s, on peut se permettre les 5000
  // tokens sans risque de 504. Coût marginal : ~1.5× les sorties courtes.
  const SONNET_TIMEOUT_MS = 90000;
  const HAIKU_TIMEOUT_MS = 50000;
  const MAX_TOKENS = 5000;

  // Helper pour construire le payload avec cache control. Anthropic cache
  // le préfixe jusqu'au dernier marqueur cache_control. Ici on a 2 marqueurs :
  // (1) système, (2) bloc client/docs. Le bloc dynamique n'est pas caché
  // car il change à chaque session.
  function buildPayload(model: string) {
    return {
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system: [
        {
          type: "text" as const,
          text: system,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [
        {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: cacheableClientBlock,
              cache_control: { type: "ephemeral" as const },
            },
            {
              type: "text" as const,
              text: dynamicSessionBlock,
            },
          ],
        },
      ],
    };
  }

  let response;
  let usedFallback = false;
  try {
    response = await getAnthropic().messages.create(
      buildPayload(EVALUATOR_MODEL),
      { timeout: SONNET_TIMEOUT_MS },
    );
  } catch (sonnetErr) {
    console.warn(
      `[evaluator] Sonnet a échoué (${(sonnetErr as Error).message}), fallback Haiku.`,
    );
    usedFallback = true;
    response = await getAnthropic().messages.create(
      buildPayload("claude-haiku-4-5-20251001"),
      { timeout: HAIKU_TIMEOUT_MS },
    );
  }
  if (usedFallback) {
    console.info("[evaluator] Débrief généré en mode Haiku (fallback).");
  }
  // Log cache hits pour suivre l'efficacité du prompt caching en prod.
  const usage = response.usage as
    | { cache_creation_input_tokens?: number; cache_read_input_tokens?: number; input_tokens: number; output_tokens: number }
    | undefined;
  if (usage) {
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheWrite = usage.cache_creation_input_tokens ?? 0;
    console.info(
      `[evaluator] tokens · in=${usage.input_tokens} cached_read=${cacheRead} cached_write=${cacheWrite} out=${usage.output_tokens}`,
    );
  }

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
    // Tentative de sauvetage : si la sortie a été tronquée par max_tokens
    // (Sonnet a généré jusqu'au plafond avant de fermer le JSON), on
    // essaye de réparer en fermant proprement les structures ouvertes.
    // Le commercial reçoit alors un débrief partiel mais valide, plutôt
    // qu'une erreur sèche.
    const salvaged = salvageTruncatedJson(cleaned);
    if (salvaged) {
      console.warn(
        "[evaluator] JSON tronqué détecté, sauvetage appliqué (criteria/quote_rewrites partiels).",
      );
      raw = salvaged;
    } else {
      throw new Error(
        `Impossible de parser l'évaluation du cerveau IA : ${(err as Error).message}\n---\n${cleaned.slice(0, 500)}`,
      );
    }
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

  // Calcul du overall_score :
  // - Mode "full" : sur les 20 critères, comme avant.
  // - Mode "block" : uniquement sur les critères de la catégorie ciblée.
  //   Les autres sont marqués hors périmètre par l'IA et ne doivent pas
  //   pénaliser le commercial qui n'a pas joué ces blocs.
  let overall_score: number;
  let criteria_total_for_display: number;
  let criteria_max_for_display: number;
  if (focusedCategory) {
    const focusedCat = categories.find((c) => c.key === focusedCategory);
    const focusedPassed = focusedCat?.score ?? 0;
    const focusedMax = focusedCat?.max ?? 0;
    overall_score =
      focusedMax > 0 ? Math.round((focusedPassed / focusedMax) * 100) : 0;
    criteria_total_for_display = focusedPassed;
    criteria_max_for_display = focusedMax;
  } else {
    overall_score = Math.round((totalPassed / TOTAL_CRITERIA) * 100);
    criteria_total_for_display = totalPassed;
    criteria_max_for_display = TOTAL_CRITERIA;
  }
  // Cold call complet : décrocher un RDV vaut au minimum 50/100, peu importe
  // le reste. Pas applicable en mode bloc où le RDV n'est pas l'objectif
  // sur 4 blocs sur 5.
  if (
    !focusedCategory &&
    input.appointmentSecured &&
    overall_score < 50
  ) {
    overall_score = 50;
  }

  return {
    overall_score,
    criteria_total: criteria_total_for_display,
    criteria_max: criteria_max_for_display,
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
