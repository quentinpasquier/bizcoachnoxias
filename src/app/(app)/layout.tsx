import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { OnboardingGuide } from "@/components/OnboardingGuide";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { UserRole } from "@/lib/supabase/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Mode démo : Supabase pas configuré → on rend l'UI avec un user fictif
  // pour permettre la prévisualisation.
  if (!isSupabaseConfigured()) {
    return (
      <div className="app-shell">
        <DemoBanner />
        <Header
          user={{
            email: "demo@noxias.com",
            full_name: "Mode démo",
            role: "commercial",
          }}
        />
        <main className="app-main">{children}</main>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Si le compte a été créé par un admin avec un mdp temporaire, on force
  // le passage par /auth/set-password avant tout accès à l'app.
  if (user.user_metadata?.must_change_password === true) {
    redirect("/auth/set-password");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role, organization_id")
    .eq("id", user.id)
    .single();

  const p = (profile ?? null) as {
    full_name: string | null;
    avatar_url: string | null;
    role: UserRole;
    organization_id: string | null;
  } | null;

  // Nom de l'org pour le header (utile pour distinguer les orgs clientes
  // et confirmer au platform_admin dans quel espace il se trouve).
  let organizationName: string | null = null;
  if (p?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", p.organization_id)
      .single();
    organizationName = (org as { name: string } | null)?.name ?? null;
  }

  return (
    <div className="app-shell">
      <Header
        user={{
          email: user.email,
          full_name: p?.full_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          role: p?.role ?? "commercial",
          organization_name: organizationName,
        }}
      />
      <main className="app-main">{children}</main>
      <OnboardingGuide />
    </div>
  );
}

function DemoBanner() {
  return (
    <div
      className="text-center text-meta uppercase tracking-widest py-2"
      style={{
        background: "var(--color-warning)",
        color: "var(--color-dark)",
      }}
    >
      Mode démo · Supabase non configuré · les données affichées sont vides ou
      d'exemple
    </div>
  );
}
