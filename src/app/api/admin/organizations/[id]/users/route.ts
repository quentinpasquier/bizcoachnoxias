import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase/service";

type AssignableRole = "commercial" | "manager" | "org_admin";
const ASSIGNABLE_ROLES: readonly AssignableRole[] = [
  "commercial",
  "manager",
  "org_admin",
];

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

// Crée un compte utilisateur dans une org avec un mot de passe défini par
// l'admin. Le flag must_change_password=true dans user_metadata force le
// user à le changer à sa première connexion (cf. (app)/layout.tsx).
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
  const password = typeof body.password === "string" ? body.password : "";
  const role: AssignableRole = ASSIGNABLE_ROLES.includes(body.role)
    ? body.role
    : "commercial";

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ error: "Nom complet obligatoire" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Mot de passe temporaire trop court (8 caractères minimum)" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .single();
  if (!org) {
    return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // pas de mail de confirmation : compte actif tout de suite
    user_metadata: {
      full_name: fullName,
      organization_id: orgId,
      role,
      must_change_password: true,
    },
  });
  if (error || !data?.user) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "email_exists" || /already.*registered/i.test(error?.message ?? "")) {
      return NextResponse.json(
        { error: `Un compte existe déjà avec l'email ${email}.` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error?.message ?? "Création impossible" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email },
  });
}
