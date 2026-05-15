import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { NewSessionForm } from "./NewSessionForm";
import { QuickLaunch } from "./QuickLaunch";
import { DIFFICULTY_CONFIG } from "@/lib/personas";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  Client,
  Difficulty,
  Gender,
  PersonaProfile,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; persona?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const configured = isSupabaseConfigured();

  let clients: Client[] = [];
  let lastConfig: {
    clientId: string;
    clientName: string;
    personaLabel: string;
    difficulty: Difficulty;
    gender: Gender;
  } | null = null;

  if (configured) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [{ data: clientsData }, lastSessionRes] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true }),
      user
        ? supabase
            .from("sessions")
            .select("client_id, client_name_snapshot, persona_label, difficulty, gender")
            .eq("user_id", user.id)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    clients = (clientsData ?? []) as Client[];

    const last = lastSessionRes.data as
      | {
          client_id: string | null;
          client_name_snapshot: string | null;
          persona_label: string;
          difficulty: Difficulty;
          gender: Gender | null;
        }
      | null;

    if (
      last?.client_id &&
      clients.some((c) => c.id === last.client_id)
    ) {
      lastConfig = {
        clientId: last.client_id,
        clientName: last.client_name_snapshot ?? "",
        personaLabel: last.persona_label,
        difficulty: last.difficulty,
        gender: (last.gender ?? "homme") as Gender,
      };
    }
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

  const formattedClients = clients.map((c) => ({
    id: c.id,
    name: c.name,
    sector: c.sector,
    value_proposition: c.value_proposition,
    product_pitch: c.product_pitch,
    target_personas: c.target_personas ?? [],
    persona_profiles: (c.persona_profiles ?? []) as PersonaProfile[],
    has_docs: Boolean(c.synced_content),
  }));

  return (
    <div className="mission-page">
      <div className="mission-blob mission-blob-purple" aria-hidden="true" />
      <div className="mission-blob mission-blob-green" aria-hidden="true" />

      <div className="container-noxias py-10 max-w-6xl mission-content space-y-10">
        <header className="space-y-3">
          <span className="mission-classified">
            <DotPulse />
            BRIEFING ROOM
          </span>
          <h1 className="mission-h1">
            Choisis ta <span className="accent">prochaine cible</span>.
          </h1>
          <p className="mission-subtitle">
            Quick Launch en 1 clic, ou configure manuellement plus bas.
          </p>
        </header>

        <QuickLaunch
          clients={formattedClients.map((c) => ({
            id: c.id,
            name: c.name,
            sector: c.sector,
            has_docs: c.has_docs,
            target_personas: c.target_personas,
            persona_profiles: c.persona_profiles,
          }))}
          lastConfig={lastConfig}
        />

        <details className="mission-custom-details">
          <summary className="mission-custom-summary">
            <span>Configurer manuellement</span>
            <span className="mission-custom-summary-hint">
              Choix précis du client, persona, niveau et voix
            </span>
          </summary>
          <div className="mission-custom-body">
            <NewSessionForm
              clients={formattedClients}
              preselectedClientId={preselectedClientId}
              preselectedPersonaLabel={preselectedPersonaLabel}
              difficulties={Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => ({
                key,
                label: cfg.label,
                description: cfg.description,
              }))}
            />
          </div>
        </details>
      </div>
    </div>
  );
}

function DotPulse() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "var(--color-green)",
        boxShadow: "0 0 0 0 rgba(60, 200, 121, 0.5)",
        animation: "login-dot-pulse 1.6s ease-out infinite",
      }}
      aria-hidden="true"
    />
  );
}
