import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/supabase/types";

export interface CurrentUser {
  id: string;
  email: string | null;
  profile: Profile;
}

// Récupère le user authentifié + son profil enrichi. Retourne null si non
// authentifié ou si le profil est absent (anomalie).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, full_name, first_name, last_name, avatar_url, role, organization_id, company, role_title, created_at, updated_at",
    )
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    profile: profile as Profile,
  };
}

export function isPlatformAdmin(role: UserRole | undefined | null): boolean {
  return role === "platform_admin";
}

export function isOrgAdmin(role: UserRole | undefined | null): boolean {
  return role === "org_admin" || role === "platform_admin";
}

export function isManagerOrAbove(role: UserRole | undefined | null): boolean {
  return role === "manager" || role === "org_admin" || role === "platform_admin";
}

// Guard pour route handlers : 401 si non connecté, 403 si pas platform_admin.
export async function requirePlatformAdmin(): Promise<
  { user: CurrentUser } | { response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }
  if (!isPlatformAdmin(user.profile.role)) {
    return {
      response: NextResponse.json(
        { error: "Accès réservé aux administrateurs Noxias" },
        { status: 403 },
      ),
    };
  }
  return { user };
}
