import Link from "next/link";
import { redirect } from "next/navigation";
import { NewClientUploader } from "./NewClientUploader";
import { NewClientWizard } from "./NewClientWizard";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { NOXIAS_ORG_ID } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect("/dashboard");
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const isNoxias = user.profile.organization_id === NOXIAS_ORG_ID;
  const forceUpload = params.mode === "upload";
  const showWizard = !isNoxias && !forceUpload;

  return (
    <div className="container-noxias py-10 max-w-3xl">
      <div className="mb-8">
        <Link
          href="/clients"
          className="text-small hover:underline"
          style={{ color: "rgba(255, 255, 255, 0.65)" }}
        >
          ← Retour aux offres
        </Link>
        <span className="divider-green block mb-3 mt-4" />
        <h1 className="text-h2">
          {showWizard ? "Nouvelle offre" : "Nouveau client"}
        </h1>
        <p
          className="text-body-l mt-2"
          style={{ color: "rgba(255, 255, 255, 0.65)" }}
        >
          {showWizard ? (
            <>
              Configure ton offre étape par étape. Renseigne ton positionnement,
              tes personas cibles et les objections que tu rencontres — Claude
              en déduit personas détaillés, briefings et scénarios pour
              entraîner ton équipe.
            </>
          ) : (
            <>
              Upload la matrice de prospection et la boîte à outils du client.
              Claude lit les docs et configure tout : pitch, personas,
              objections, briefings de préparation pour les commerciaux.
            </>
          )}
        </p>
        {!isNoxias && (
          <p
            className="text-meta mt-3"
            style={{ color: "rgba(255, 255, 255, 0.55)" }}
          >
            {forceUpload ? (
              <>
                Mode upload sélectionné.{" "}
                <Link
                  href="/clients/new"
                  className="hover:underline"
                  style={{ color: "var(--color-green)", fontWeight: 700 }}
                >
                  Revenir au builder guidé →
                </Link>
              </>
            ) : (
              <>
                Tu as déjà une matrice de prospection et une boîte à outils
                rédigées ?{" "}
                <Link
                  href="/clients/new?mode=upload"
                  className="hover:underline"
                  style={{ color: "var(--color-green)", fontWeight: 700 }}
                >
                  Upload-les directement →
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      {showWizard ? <NewClientWizard /> : <NewClientUploader />}
    </div>
  );
}
