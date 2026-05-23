import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase/service";
import { NOXIAS_ORG_ID } from "@/lib/supabase/types";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePlatformAdmin();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const supabase = createServiceClient();
  const [{ data: org }, { count: usersCount }, { count: clientsCount }, { count: sessionsCount }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug, active, created_at, updated_at")
        .eq("id", id)
        .single(),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id),
      supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id),
    ]);

  if (!org) {
    return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    organization: org,
    stats: {
      users: usersCount ?? 0,
      clients: clientsCount ?? 0,
      sessions: sessionsCount ?? 0,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePlatformAdmin();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim().length > 0) {
    update.name = body.name.trim();
  }
  if (typeof body.active === "boolean") {
    update.active = body.active;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", id)
    .select("id, name, slug, active, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Mise à jour impossible" },
      { status: 500 },
    );
  }
  return NextResponse.json({ organization: data });
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePlatformAdmin();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  if (id === NOXIAS_ORG_ID) {
    return NextResponse.json(
      { error: "L'organisation Noxias ne peut pas être supprimée." },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  // Refuse de supprimer une org qui contient encore des users/clients/sessions.
  // (Cascade silencieuse trop risquée.)
  const [{ count: u }, { count: c }, { count: s }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", id),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", id),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", id),
  ]);
  if ((u ?? 0) > 0 || (c ?? 0) > 0 || (s ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `Suppression impossible : l'org contient encore ${u ?? 0} user(s), ${c ?? 0} client(s), ${s ?? 0} session(s). Désactive-la ou nettoie les données d'abord.`,
      },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("organizations").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
