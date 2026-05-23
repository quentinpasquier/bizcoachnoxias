import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DIFFICULTY_CONFIG } from "@/lib/personas";
import { generateScenario } from "@/lib/scenario-generator";
import type { Client, Difficulty, Gender } from "@/lib/supabase/types";

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
    })
    .select("id")
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: error?.message ?? "Création de session impossible" },
      { status: 500 },
    );
  }

  return NextResponse.json({ sessionId: (session as { id: string }).id });
}
