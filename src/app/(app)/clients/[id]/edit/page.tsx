import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientForm } from "../../ClientForm";
import { NewClientWizard } from "../../new/NewClientWizard";
import { createClient } from "@/lib/supabase/server";
import { getClientVocab } from "@/lib/vocabulary";
import type { Client } from "@/lib/supabase/types";
import type { GuidedWizardPayload } from "@/lib/guided-serializer";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { data: { user } }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.auth.getUser(),
  ]);

  if (!data) notFound();
  const client = data as Client;
  const guidedPayload = client.guided_payload as GuidedWizardPayload | null;

  let organizationId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    organizationId = (profile as { organization_id: string } | null)
      ?.organization_id ?? null;
  }
  const vocab = getClientVocab(organizationId);

  return (
    <div className="container-noxias py-10 max-w-3xl">
      <div className="mb-8">
        <Link
          href={`/clients/${id}`}
          className="text-small hover:underline"
          style={{ color: "rgba(255, 255, 255, 0.65)" }}
        >
          ← Retour à la fiche
        </Link>
        <span className="divider-green block mb-3 mt-4" />
        <h1 className="text-h2">Modifier {client.name}</h1>
        {guidedPayload && (
          <p
            className="text-small mt-2"
            style={{ color: "rgba(255, 255, 255, 0.65)" }}
          >
            Édite tes réponses du builder. Le cerveau IA regénère les
            personas, les objections et les briefings à l&apos;enregistrement
            (30 à 60 sec).
          </p>
        )}
      </div>

      {guidedPayload ? (
        <NewClientWizard
          initial={{ id: client.id, payload: guidedPayload }}
        />
      ) : (
        <ClientForm initial={client} vocab={vocab} />
      )}
    </div>
  );
}
