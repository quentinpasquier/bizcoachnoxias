// Convertit le payload du wizard "configuration guidée" (orgs clientes qui
// n'ont pas de matrice de prospection formalisée) en un blob texte structuré
// qui mime une matrice + boîte à outils. Ce blob est ensuite passé à
// extractClientFields() : pas besoin de toucher au pipeline d'extraction
// existant utilisé par les commerciaux Noxias.

export interface GuidedPersonaInput {
  label: string;
  role: string;
  typical_company: string;
  key_pains: string;
  key_kpis: string;
  motivations: string;
  triggers: string;
  decision_signals: string;
}

export interface GuidedWizardPayload {
  name: string;
  sector: string;
  value_prop_one_liner: string;
  product_pitch: string;
  ideal_targets: string;
  tangible_value: string;
  channels: string;
  differentiation: string;
  personas: GuidedPersonaInput[];
  selected_common_objections: string[];
  specific_objections: string;
  hook: string;
  killer_arguments: string;
}

function bullets(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith("-") || s.startsWith("•") ? s : `- ${s}`))
    .join("\n");
}

function block(title: string, body: string | undefined | null): string {
  const cleaned = (body ?? "").trim();
  if (!cleaned) return "";
  return `## ${title}\n\n${cleaned}\n`;
}

function personaBlock(p: GuidedPersonaInput, idx: number): string {
  const num = String(idx + 1).padStart(2, "0");
  const lines: string[] = [
    `# Persona ${num} · ${p.label || "Sans nom"}`,
    "",
  ];
  if (p.role) lines.push(`**Rôle** : ${p.role}`);
  if (p.typical_company) lines.push(`**Entreprise typique** : ${p.typical_company}`);
  lines.push("");
  if (p.key_pains.trim()) {
    lines.push("**Douleurs principales**");
    lines.push(bullets(p.key_pains));
    lines.push("");
  }
  if (p.key_kpis.trim()) {
    lines.push("**KPI surveillés**");
    lines.push(bullets(p.key_kpis));
    lines.push("");
  }
  if (p.motivations.trim()) {
    lines.push("**Motivations / Priorités**");
    lines.push(bullets(p.motivations));
    lines.push("");
  }
  if (p.triggers.trim()) {
    lines.push("**Déclencheurs d'achat**");
    lines.push(bullets(p.triggers));
    lines.push("");
  }
  if (p.decision_signals)
    lines.push(`**Signal de décision (ce qui déclenche un OUI au RDV)** : ${p.decision_signals}`);
  return lines.join("\n");
}

export function serializeGuidedPayload(payload: GuidedWizardPayload): string {
  const objections = [
    ...payload.selected_common_objections,
    ...payload.specific_objections
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  ];

  const sections: string[] = [];

  sections.push(
    [
      `# === Matrice de prospection · ${payload.name || "Client"} ===`,
      "",
      "Document généré à partir du builder guidé. Représente la matrice de prospection et la boîte à outils du client.",
      "",
    ].join("\n"),
  );

  sections.push(block("1. Identité de l'offre", [
    payload.name ? `**Nom** : ${payload.name}` : "",
    payload.sector ? `**Secteur** : ${payload.sector}` : "",
  ].filter(Boolean).join("\n")));

  sections.push(block("2. Proposition de valeur", [
    payload.value_prop_one_liner ? `**Promesse en une phrase** : ${payload.value_prop_one_liner}` : "",
    payload.product_pitch ? `\n**Pitch produit** : ${payload.product_pitch}` : "",
    payload.tangible_value ? `\n**Valeur tangible livrée (30-60 j)** : ${payload.tangible_value}` : "",
    payload.differentiation ? `\n**Différenciation concurrentielle** : ${payload.differentiation}` : "",
  ].filter(Boolean).join("\n")));

  sections.push(block("3. Cibles idéales et canaux", [
    payload.ideal_targets ? `**Cibles idéales** : ${payload.ideal_targets}` : "",
    payload.channels ? `\n**Où les trouver** : ${payload.channels}` : "",
  ].filter(Boolean).join("\n")));

  if (payload.personas.length > 0) {
    sections.push("## 4. Personas cibles\n");
    payload.personas.forEach((p, i) => sections.push(personaBlock(p, i)));
  }

  if (objections.length > 0) {
    sections.push("## 5. Objections à préparer\n");
    sections.push(
      "Toutes les objections suivantes doivent être incluses dans typical_objections (exhaustif).",
    );
    sections.push("");
    sections.push(objections.map((o) => `- ${o}`).join("\n"));
    sections.push("");
  }

  if (payload.hook || payload.killer_arguments) {
    sections.push("## 6. Accroche et arguments massue\n");
    if (payload.hook) {
      sections.push(`**Accroche d'ouverture** :\n${payload.hook}\n`);
    }
    if (payload.killer_arguments.trim()) {
      sections.push("**Arguments massue (killer arguments)** :");
      sections.push(bullets(payload.killer_arguments));
      sections.push("");
    }
  }

  return sections.join("\n");
}
