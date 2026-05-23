import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase/service";

type AssignableRole = "commercial" | "manager" | "org_admin";
const ASSIGNABLE_ROLES: readonly AssignableRole[] = [
  "commercial",
  "manager",
  "org_admin",
];

// Trouve l'URL de l'app pour construire le redirect d'invitation.
// Priorité : NEXT_PUBLIC_APP_URL (env Vercel) > origin de la requête.
function resolveAppUrl(request: Request): string {
  const envUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePlatformAdmin();
  if ("response" in guard) return guard.response;
  const { id: orgId } = await params;

  const supabase = createServiceClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, first_name, last_name, avatar_url, role, organization_id, created_at",
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Récupère les emails via auth.admin (RLS contourné)
  const ids = (profiles ?? []).map((p) => (p as { id: string }).id);
  const emailById = new Map<string, string | null>();
  if (ids.length > 0) {
    const { data: list } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    list?.users?.forEach((u) => {
      if (ids.includes(u.id)) emailById.set(u.id, u.email ?? null);
    });
  }

  const users = (profiles ?? []).map((p) => {
    const row = p as {
      id: string;
      full_name: string | null;
      role: string;
      avatar_url: string | null;
      created_at: string;
    };
    return {
      id: row.id,
      full_name: row.full_name,
      role: row.role,
      avatar_url: row.avatar_url,
      email: emailById.get(row.id) ?? null,
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ users });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePlatformAdmin();
  if ("response" in guard) return guard.response;
  const { id: orgId } = await params;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const role: AssignableRole = ASSIGNABLE_ROLES.includes(body.role)
    ? body.role
    : "commercial";
  const sendInvite = body.send_invite !== false; // par défaut, envoie le mail

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ error: "Nom complet obligatoire" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Vérifie que l'org existe
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .single();
  if (!org) {
    return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
  }

  // Si sendInvite : envoie un email d'invitation magic-link (le user fixe son mdp)
  // Sinon : crée le user avec un mdp aléatoire (à communiquer à la main)
  const userMetadata = {
    full_name: fullName,
    organization_id: orgId,
    role,
  };

  if (sendInvite) {
    // L'invité reçoit un lien magique. Après vérification du token côté
    // Supabase, il est redirigé vers /auth/callback (qui échange le code
    // PKCE contre une session) puis vers /auth/set-password pour fixer
    // son mot de passe.
    const appUrl = resolveAppUrl(request);
    const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent("/auth/set-password")}`;
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: userMetadata,
      redirectTo,
    });
    if (error || !data?.user) {
      return NextResponse.json(
        { error: error?.message ?? "Invitation impossible" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      user: { id: data.user.id, email: data.user.email },
      invited: true,
    });
  }

  const tempPassword =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: userMetadata,
  });
  if (error || !data?.user) {
    return NextResponse.json(
      { error: error?.message ?? "Création impossible" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email },
    invited: false,
    temp_password: tempPassword,
  });
}
