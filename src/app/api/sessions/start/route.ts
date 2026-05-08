import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPersona, DIFFICULTY_CONFIG } from "@/lib/personas";
import type { Client, Difficulty } from "@/lib/supabase/types";

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
    personaKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { clientId, difficulty, personaKey } = body;

  if (!difficulty || !(difficulty in DIFFICULTY_CONFIG)) {
    return NextResponse.json({ error: "Difficulté invalide" }, { status: 400 });
  }
  const persona = personaKey ? getPersona(personaKey) : null;
  if (!persona) {
    return NextResponse.json({ error: "Persona invalide" }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "Client manquant" }, { status: 400 });
  }

  const { data: clientData, error: clientErr } = await supabase
    .from("clients")
    .select("id, name, product_pitch")
    .eq("id", clientId)
    .single();

  if (clientErr || !clientData) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  const client = clientData as Pick<Client, "id" | "name" | "product_pitch">;

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      client_id: client.id,
      client_name_snapshot: client.name,
      difficulty: difficulty as Difficulty,
      persona_key: persona.key,
      persona_label: persona.label,
      product_pitch: client.product_pitch,
      objective: "rdv",
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
