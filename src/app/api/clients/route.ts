import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "Nom obligatoire" }, { status: 400 });
  }
  if (typeof body.product_pitch !== "string" || body.product_pitch.trim().length === 0) {
    return NextResponse.json({ error: "Pitch obligatoire" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: body.name.trim(),
      sector: body.sector ?? null,
      description: body.description ?? null,
      value_proposition: body.value_proposition ?? null,
      product_pitch: body.product_pitch.trim(),
      ideal_targets: body.ideal_targets ?? null,
      matrice_url: body.matrice_url ?? null,
      toolbox_url: body.toolbox_url ?? null,
      target_personas: Array.isArray(body.target_personas)
        ? body.target_personas
        : [],
      typical_objections: Array.isArray(body.typical_objections)
        ? body.typical_objections
        : [],
      active: body.active ?? true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Création impossible" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: (data as { id: string }).id });
}
