import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase/service";

type AssignableRole = "commercial" | "manager" | "org_admin";
const ASSIGNABLE_ROLES: readonly AssignableRole[] = [
  "commercial",
  "manager",
  "org_admin",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const guard = await requirePlatformAdmin();
  if ("response" in guard) return guard.response;
  const { id: orgId, userId } = await params;

  const body = await request.json().catch(() => null);
  if (!body || !ASSIGNABLE_ROLES.includes(body.role)) {
    return NextResponse.json(
      { error: "Rôle invalide. Valeurs : commercial | manager | org_admin" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: body.role })
    .eq("id", userId)
    .eq("organization_id", orgId)
    .select("id, role")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error:
          error?.message ?? "Utilisateur introuvable dans cette organisation",
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ profile: data });
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const guard = await requirePlatformAdmin();
  if ("response" in guard) return guard.response;
  const { id: orgId, userId } = await params;

  const supabase = createServiceClient();

  // Sécurité : vérifie que ce user appartient bien à cette org avant de le
  // supprimer (évite qu'un appel mal formé supprime un user Noxias).
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", userId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }
  const p = profile as { organization_id: string; role: string };
  if (p.organization_id !== orgId) {
    return NextResponse.json(
      { error: "Cet utilisateur n'appartient pas à cette organisation" },
      { status: 400 },
    );
  }
  if (p.role === "platform_admin") {
    return NextResponse.json(
      {
        error:
          "Impossible de supprimer un platform_admin depuis cette interface. À faire en SQL.",
      },
      { status: 400 },
    );
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Le profil est supprimé en cascade via FK on delete cascade.
  return NextResponse.json({ ok: true });
}
