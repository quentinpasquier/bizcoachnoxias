import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = body.name.trim();
  if ("sector" in body) update.sector = body.sector;
  if ("description" in body) update.description = body.description;
  if ("value_proposition" in body)
    update.value_proposition = body.value_proposition;
  if (typeof body.product_pitch === "string")
    update.product_pitch = body.product_pitch.trim();
  if ("ideal_targets" in body) update.ideal_targets = body.ideal_targets;
  if ("matrice_url" in body) update.matrice_url = body.matrice_url;
  if ("toolbox_url" in body) update.toolbox_url = body.toolbox_url;
  if (Array.isArray(body.target_personas))
    update.target_personas = body.target_personas;
  if (Array.isArray(body.typical_objections))
    update.typical_objections = body.typical_objections;
  if (typeof body.active === "boolean") update.active = body.active;

  const { error } = await supabase.from("clients").update(update).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
