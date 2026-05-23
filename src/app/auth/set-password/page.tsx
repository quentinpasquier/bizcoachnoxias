import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si pas de session → l'invité a probablement perdu / mal cliqué le lien.
  // On l'envoie sur /login avec un message clair.
  if (!user) {
    redirect(
      "/login?error=" +
        encodeURIComponent(
          "Lien d'invitation invalide ou expiré. Demande un nouveau lien à ton administrateur.",
        ),
    );
  }

  // Récupère le nom de l'org pour personnaliser l'écran
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, organization_id, role")
    .eq("id", user.id)
    .single();

  let orgName: string | null = null;
  const p = profile as {
    full_name: string | null;
    organization_id: string | null;
    role: string;
  } | null;
  if (p?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", p.organization_id)
      .single();
    orgName = (org as { name: string } | null)?.name ?? null;
  }

  return (
    <div className="container-noxias py-16 max-w-xl mx-auto">
      <div className="ui-card ui-card-padded space-y-6">
        <div>
          <h1 className="text-h2">Bienvenue{p?.full_name ? ` ${p.full_name.split(" ")[0]}` : ""}.</h1>
          <p
            className="text-body mt-2"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            {orgName ? (
              <>
                Tu rejoins l&apos;espace <strong>{orgName}</strong>. Crée ton mot de
                passe pour activer ton compte.
              </>
            ) : (
              <>Crée ton mot de passe pour activer ton compte.</>
            )}
          </p>
        </div>

        <SetPasswordForm email={user.email ?? ""} />

        <p
          className="text-meta"
          style={{ color: "rgba(255, 255, 255, 0.45)" }}
        >
          Tu pourras le changer à tout moment depuis ton profil.{" "}
          <Link href="/login" className="underline">
            Annuler
          </Link>
        </p>
      </div>
    </div>
  );
}
