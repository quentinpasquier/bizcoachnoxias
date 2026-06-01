import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DIFFICULTY_CONFIG } from "@/lib/personas";
import { generateScenario } from "@/lib/scenario-generator";
import { pickFlashOpener } from "@/lib/flash-blocks";
import { isManagerOrAbove } from "@/lib/auth-helpers";
import type { Client, Difficulty, Gender, UserRole } from "@/lib/supabase/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: {
    clientId?: string;
    difficulty?: string;
    gender?: string;
    personaLabel?: string;
    trainingMode?: string;
    blockTarget?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { clientId, difficulty, gender, personaLabel } = body;

  if (!difficulty || !(difficulty in DIFFICULTY_CONFIG)) {
    return NextResponse.json({ error: "Difficulté invalide" }, { status: 400 });
  }
  if (gender !== "homme" && gender !== "femme") {
    return NextResponse.json({ error: "Genre invalide (homme|femme)" }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "Client manquant" }, { status: 400 });
  }
  if (!personaLabel || personaLabel.trim().length === 0) {
    return NextResponse.json({ error: "Persona manquant" }, { status: 400 });
  }

  // Mode d'entraînement : 'full' par défaut (compatibilité historique).
  // 'block' nécessite un blockTarget. 'embedded' arrive en PR ultérieure
  // mais le validateur l'accepte déjà pour ne pas avoir à modifier la route
  // quand on l'activera côté UI.
  const trainingMode = (body.trainingMode ?? "full") as "full" | "block" | "embedded";
  if (!["full", "block", "embedded"].includes(trainingMode)) {
    return NextResponse.json(
      { error: "Mode d'entraînement invalide (full | block | embedded)." },
      { status: 400 },
    );
  }
  // Bêta interne : "embedded" est restreint aux rôles manager+ pendant
  // la phase de test. Défense en profondeur — la page UI verrouille déjà
  // la carte, mais on protège aussi la route au cas où.
  if (trainingMode === "embedded") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = ((profile as { role?: UserRole } | null)?.role ??
      "commercial") as UserRole;
    if (!isManagerOrAbove(role)) {
      return NextResponse.json(
        {
          error:
            "Le mode Coaching embarqué est en bêta interne. Demande à ton manager d'y accéder.",
        },
        { status: 403 },
      );
    }
  }
  const VALID_BLOCKS = [
    "brise_glace",
    "decouverte",
    "pitch",
    "objections",
    "closing",
  ] as const;
  let blockTarget: (typeof VALID_BLOCKS)[number] | null = null;
  if (trainingMode === "block") {
    const candidate = body.blockTarget;
    if (
      !candidate ||
      !VALID_BLOCKS.includes(candidate as (typeof VALID_BLOCKS)[number])
    ) {
      return NextResponse.json(
        {
          error:
            "blockTarget requis pour le mode 'block' (brise_glace | decouverte | pitch | objections | closing).",
        },
        { status: 400 },
      );
    }
    blockTarget = candidate as (typeof VALID_BLOCKS)[number];
  }

  const { data: clientData, error: clientErr } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientErr || !clientData) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }
  const client = clientData as Client;

  // Récupère les 3 derniers scénarios joués par CE commercial sur CE client.
  // Sert à empêcher le générateur de retomber sur les mêmes nom/entreprise.
  // Limité à 3 pour ne pas exploser le contexte ni la latence (1 query légère).
  const { data: recentSessionsData } = await supabase
    .from("sessions")
    .select("scenario_data")
    .eq("user_id", user.id)
    .eq("client_id", client.id)
    .not("scenario_data", "is", null)
    .order("started_at", { ascending: false })
    .limit(3);

  const recentScenarios = (recentSessionsData ?? [])
    .map((row) => row.scenario_data as { persona_name?: string; persona_role?: string; company_name?: string } | null)
    .filter((s): s is { persona_name: string; persona_role: string; company_name: string } =>
      Boolean(s && s.persona_name && s.persona_role && s.company_name),
    )
    .map((s) => ({
      persona_name: s.persona_name,
      persona_role: s.persona_role,
      company_name: s.company_name,
    }));

  // Génère le scénario via Claude (peut prendre 5-10s)
  let scenario;
  try {
    scenario = await generateScenario({
      client,
      difficulty: difficulty as Difficulty,
      gender: gender as Gender,
      personaLabel: personaLabel.trim(),
      recentScenarios,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Génération du scénario échouée : ${(err as Error).message}` },
      { status: 500 },
    );
  }

  // Drill flash : pour le mode "block" uniquement, on tire une phrase
  // d'amorce dans le pool du bloc choisi et on la stocke dans
  // scenario_data.flash_meta. Elle sera utilisée comme 1ʳᵉ réplique prospect
  // déterministe (sans appel LLM), affichée sur la fiche flash du briefing,
  // et épinglée pendant l'appel.
  if (trainingMode === "block" && blockTarget) {
    const opener = pickFlashOpener(blockTarget);
    scenario = {
      ...scenario,
      flash_meta: {
        opener_id: opener.id,
        opener_text: opener.text,
        family: opener.family,
      },
    };
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      client_id: client.id,
      client_name_snapshot: client.name,
      difficulty: difficulty as Difficulty,
      gender,
      persona_key: personaLabel.trim().toLowerCase().replace(/\s+/g, "-"),
      persona_label: personaLabel.trim(),
      product_pitch: client.product_pitch,
      objective: "rdv",
      scenario_data: scenario,
      training_mode: trainingMode,
      block_target: blockTarget,
      embedded_blocks_count: trainingMode === "embedded" ? 0 : null,
    })
    .select("id")
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: error?.message ?? "Création de session impossible" },
      { status: 500 },
    );
  }

  // Drill flash : on inscrit la phrase d'amorce comme 1ʳᵉ réplique prospect
  // directement en DB. Comme ça, le ChatRoom la trouve dans initialMessages
  // au montage (donc pas d'appel à /api/sessions/[id]/message?opening=true)
  // et la voix TTS la lit immédiatement, sans attendre Claude. L'amorce reste
  // 100% déterministe par rapport à ce qui était annoncé sur la fiche flash.
  if (trainingMode === "block" && scenario.flash_meta) {
    await supabase.from("messages").insert({
      session_id: (session as { id: string }).id,
      role: "prospect",
      content: scenario.flash_meta.opener_text,
    });
  }

  return NextResponse.json({ sessionId: (session as { id: string }).id });
}
