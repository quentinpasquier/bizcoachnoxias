import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientForm } from "../../ClientForm";
import { NewClientWizard } from "../../new/NewClientWizard";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/supabase/types";
import type { GuidedWizardPayload } from "@/lib/guided-serializer";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").eq("id", id).single();

  if (!data) notFound();
  const client = data as Client;
  const guidedPayload = client.guided_payload as GuidedWizardPayload | null;

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
            Édite tes réponses du builder. Claude regénère les personas, les
            objections et les briefings à l'enregistrement (30 à 60 sec).
          </p>
        )}
      </div>

      {guidedPayload ? (
        <NewClientWizard
          initial={{ id: client.id, payload: guidedPayload }}
        />
      ) : (
        <ClientForm initial={client} />
      )}
    </div>
  );
}
