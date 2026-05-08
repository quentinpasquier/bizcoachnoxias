import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { NewSessionForm } from "./NewSessionForm";
import { DIFFICULTY_CONFIG } from "@/lib/personas";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Client, PersonaProfile } from "@/lib/supabase/types";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; persona?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const configured = isSupabaseConfigured();

  let clients: Client[] = [];
  if (configured) {
    const { data: clientsData } = await supabase
      .from("clients")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true });
    clients = (clientsData ?? []) as Client[];
  }

  if (clients.length === 0) {
    return (
      <div className="container-noxias py-10 max-w-2xl">
        <div className="mb-8">
          <span className="divider-green block mb-3" />
          <h1 className="text-h2">Nouvelle session</h1>
        </div>
        <Card variant="lavender" className="text-center py-12">
          <h3 className="text-h3 mb-2">
            {configured ? "Aucun client actif." : "Aucun client (mode démo)."}
          </h3>
          <p className="text-body mb-6" style={{ color: "var(--color-gray)" }}>
            Avant de lancer une session, ajoute un client en uploadant ses docs.
          </p>
          <Link href="/clients/new" className="btn btn-primary inline-flex">
            Ajouter un client
          </Link>
        </Card>
      </div>
    );
  }

  if (!params.client && clients.length === 1) {
    redirect(`/sessions/new?client=${clients[0].id}`);
  }

  const preselectedClientId = params.client ?? "";
  const preselectedPersonaLabel = params.persona ?? "";

  return (
    <div className="container-noxias py-10 max-w-3xl">
      <div className="mb-8">
        <span className="divider-green block mb-3" />
        <h1 className="text-h2">Nouvelle session</h1>
        <p className="text-body mt-1" style={{ color: "var(--color-gray)" }}>
          Choisis le persona, le genre et le niveau.
          Un scénario réaliste est généré à la volée.
        </p>
      </div>

      <NewSessionForm
        clients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          sector: c.sector,
          value_proposition: c.value_proposition,
          product_pitch: c.product_pitch,
          target_personas: c.target_personas ?? [],
          persona_profiles: (c.persona_profiles ?? []) as PersonaProfile[],
          has_docs: Boolean(c.synced_content),
        }))}
        preselectedClientId={preselectedClientId}
        preselectedPersonaLabel={preselectedPersonaLabel}
        difficulties={Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => ({
          key,
          label: cfg.label,
          description: cfg.description,
        }))}
      />
    </div>
  );
}
