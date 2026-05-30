import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { NewSessionForm } from "./NewSessionForm";
import { QuickLaunch } from "./QuickLaunch";
import { TrainingModeSelection } from "./TrainingModeSelection";
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
  searchParams: Promise<{
    client?: string;
    persona?: string;
    mode?: "full" | "block" | "embedded";
  }>;
}) {
  const params = await searchParams;
  // Si aucun mode n'est dans l'URL : on affiche la page d'accueil
  // d'entraînement avec les 3 grandes cartes (Pourquoi / Quoi / Comment).
  // Le commercial choisit, puis on revient sur la même URL avec ?mode=X
  // et on bascule sur la vue de configuration.
  const modeSelected: "full" | "block" | "embedded" | null =
    params.mode === "full" ||
    params.mode === "block" ||
    params.mode === "embedded"
      ? params.mode
      : null;
  const trainingMode: "full" | "block" | "embedded" = modeSelected ?? "full";
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

    if (last?.client_id && clients.some((c) => c.id === last.client_id)) {
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
          <h1 className="text-h2">Nouvel entraînement</h1>
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

  // Classe de thème : pose la couleur d'accent du mode actif sur le
  // container, propagée via la variable CSS --mode-accent aux enfants.
  // Sans mode sélectionné, on garde le thème vert par défaut.
  const themeClass = modeSelected ? `training-theme-${modeSelected}` : "";

  return (
    <div className={`container-noxias py-10 max-w-6xl space-y-10 ${themeClass}`}>
      {/* Mode NON choisi : page d'accueil entraînement avec 3 grandes
          cartes pédagogiques (Pourquoi / Quoi / Comment / Bénéfices). */}
      {!modeSelected && <TrainingModeSelection />}

      {/* Mode CHOISI : breadcrumb pour revenir au choix + header de
          configuration adapté au mode, teinté de la couleur du mode. */}
      {modeSelected && (
        <header className="space-y-3 training-config-header">
          <Link href="/sessions/new" className="training-mode-breadcrumb">
            <span aria-hidden="true">←</span> Changer de mode d&apos;entraînement
          </Link>
          <div className="training-mode-eyebrow">
            {trainingMode === "block"
              ? "Mode Coaching ciblé"
              : trainingMode === "embedded"
                ? "Mode Coaching embarqué"
                : "Mode Appel complet"}
          </div>
          <h1
            className="text-h1"
            style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
              lineHeight: "1.05",
            }}
          >
            Paramètre ton entraînement.
          </h1>
          <p
            className="text-body-l"
            style={{ color: "rgba(255,255,255,0.7)", maxWidth: "56ch" }}
          >
            {trainingMode === "block"
              ? "Choisis ton offre et le bloc à travailler. La conversation démarre directement à ce bloc en 2 à 3 minutes."
              : trainingMode === "embedded"
                ? "Choisis ton offre. Le coach IA évalue chaque réponse, te bloque si tu n'avances pas et t'explique quoi reformuler."
                : "Choisis ton offre, ton persona et ton niveau. L'appel se déroule de bout en bout, comme dans la vraie vie."}
          </p>
        </header>
      )}

      {/* Quick Launch : disponible uniquement en mode "full" choisi. */}
      {modeSelected && trainingMode === "full" && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <div className="eyebrow-green">Quick Launch · 1 clic</div>
              <h2 className="text-h3 mt-1">Démarre en 5 secondes.</h2>
            </div>
            <span
              className="text-meta"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Briefing généré en 5-10 s
            </span>
          </div>
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
            compact
          />
        </section>
      )}

      {/* Configuration sur mesure : visible uniquement quand un mode
          d'entraînement a été explicitement choisi. */}
      {modeSelected && (
        <section className="space-y-5">
          <div>
          <div className="eyebrow" style={{ color: "#b495ff" }}>
            {trainingMode === "block"
              ? "Configuration du coaching ciblé"
              : trainingMode === "embedded"
                ? "Configuration du coaching embarqué"
                : "Configuration sur mesure"}
          </div>
          <h2 className="text-h3 mt-1">
            {trainingMode === "block"
              ? "Choisis ton client et ton bloc à travailler."
              : trainingMode === "embedded"
                ? "Choisis ton client. Le coach IA fera le reste."
                : "Choisis chaque paramètre."}
          </h2>
          <p
            className="text-small mt-1"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            {trainingMode === "block"
              ? "Tu vas démarrer DIRECTEMENT au bloc choisi. Le scoring final se concentre sur les critères de ce bloc, pas sur l'appel entier."
              : trainingMode === "embedded"
                ? "L'appel se déroule normalement, mais à chaque réponse, un coach IA évalue si tu fais avancer la conversation. Si ce n'est pas le cas, il te bloque, t'explique pourquoi et te demande de reformuler. 3 essais max par réplique, puis il te donne la formulation modèle."
                : "Le meilleur outil pour cibler ta progression : client précis, persona précis, niveau précis, voix précise."}
          </p>
        </div>
        <NewSessionForm
          clients={formattedClients}
          preselectedClientId={preselectedClientId}
          preselectedPersonaLabel={preselectedPersonaLabel}
          difficulties={Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => ({
            key,
            label: cfg.label,
            description: cfg.description,
          }))}
          trainingMode={trainingMode}
          lastClientId={lastConfig?.clientId ?? null}
        />
        </section>
      )}
    </div>
  );
}
