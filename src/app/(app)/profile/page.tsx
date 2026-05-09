import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ProfileForm } from "./ProfileForm";
import type { Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, full_name, first_name, last_name, avatar_url, role, company, role_title, created_at, updated_at",
    )
    .eq("id", user.id)
    .single();

  const profile = (data ?? null) as Profile | null;

  return (
    <div className="container-noxias py-12 space-y-8 max-w-3xl">
      <PageHeader
        title="Ton profil"
        subtitle="Personnalise ton identité dans l'app : photo, prénom, nom."
      />

      <Card>
        <ProfileForm
          email={user.email ?? ""}
          initialFirstName={profile?.first_name ?? ""}
          initialLastName={profile?.last_name ?? ""}
          initialAvatarUrl={profile?.avatar_url ?? null}
          role={profile?.role ?? "commercial"}
        />
      </Card>
    </div>
  );
}
