import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
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
      <div className="min-h-screen flex flex-col">
        <DemoBanner />
        <Header
          user={{
            email: "demo@noxias.com",
            full_name: "Mode démo",
            role: "commercial",
          }}
        />
        <main className="flex-1">{children}</main>
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role")
    .eq("id", user.id)
    .single();

  const p = (profile ?? null) as {
    full_name: string | null;
    avatar_url: string | null;
    role: UserRole;
  } | null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        user={{
          email: user.email,
          full_name: p?.full_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          role: p?.role ?? "commercial",
        }}
      />
      <main className="flex-1">{children}</main>
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
