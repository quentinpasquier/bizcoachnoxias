import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientForm } from "../../ClientForm";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/supabase/types";

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
      </div>

      <ClientForm initial={client} />
    </div>
  );
}
