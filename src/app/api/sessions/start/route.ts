import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPersona, DIFFICULTY_CONFIG } from "@/lib/personas";
import type { Difficulty } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { difficulty?: string; personaKey?: string; productPitch?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { difficulty, personaKey, productPitch } = body;

  if (!difficulty || !(difficulty in DIFFICULTY_CONFIG)) {
    return NextResponse.json({ error: "Difficulté invalide" }, { status: 400 });
  }
  const persona = personaKey ? getPersona(personaKey) : null;
  if (!persona) {
    return NextResponse.json({ error: "Persona invalide" }, { status: 400 });
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      difficulty: difficulty as Difficulty,
      persona_key: persona.key,
      persona_label: persona.label,
      product_pitch: productPitch ?? null,
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

  return NextResponse.json({ sessionId: session.id });
}
