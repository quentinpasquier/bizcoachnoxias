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
  searchParams: Promise<{
    client?: string;
    persona?: string;
    mode?: "full" | "block";
  }>;
}) {
  const params = await searchParams;
  const trainingMode: "full" | "block" =
    params.mode === "block" ? "block" : "full";
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

  return (
    <div className="container-noxias py-10 max-w-6xl space-y-10">
      <header className="space-y-3">
        <div className="eyebrow-green">Briefing room</div>
        <h1
          className="text-h1"
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: "1.05",
          }}
        >
          <span>Lance </span>
          <span style={{ color: "var(--color-green)" }}>ton</span>{" "}
          <span>entraînement.</span>
        </h1>
        <p
          className="text-body-l"
          style={{ color: "rgba(255,255,255,0.7)", maxWidth: "56ch" }}
        >
          Trois modes pour progresser : ciblé sur un bloc, embarqué avec un
          coach IA en direct, ou appel complet sans filet.
        </p>
      </header>

      {/* Sélecteur de mode d'entraînement. Activé : Coaching ciblé (PR B)
          et Appel complet (PR A). Désactivé : Coaching embarqué (PR C). */}
      <section className="space-y-4">
        <div className="eyebrow-green">Choisis ton mode</div>
        <div className="training-mode-grid">
          <Link
            href="/sessions/new?mode=block"
            className={`training-mode-card training-mode-card-link ${
              trainingMode === "block" ? "training-mode-card-active" : ""
            }`}
          >
            <div
              className={`training-mode-card-badge ${
                trainingMode === "block"
                  ? "training-mode-card-badge-active"
                  : ""
              }`}
            >
              {trainingMode === "block" ? "Actif" : "Disponible"}
            </div>
            <div className="training-mode-card-icon" aria-hidden="true">
              🎯
            </div>
            <h3 className="training-mode-card-title">Coaching ciblé</h3>
            <p className="training-mode-card-desc">
              Entraîne-toi sur UN bloc en 2-3 minutes : brise-glace,
              découverte, pitch, objections ou closing. Idéal pour bosser un
              point faible identifié.
            </p>
          </Link>

          <article className="training-mode-card training-mode-card-disabled">
            <div className="training-mode-card-badge">Bientôt</div>
            <div className="training-mode-card-icon" aria-hidden="true">
              🧑‍🏫
            </div>
            <h3 className="training-mode-card-title">Coaching embarqué</h3>
            <p className="training-mode-card-desc">
              Appel complet avec un coach IA qui te corrige en direct. Il te
              bloque si ta réponse ne fait pas avancer, et t&apos;explique
              quoi reformuler.
            </p>
          </article>

          <Link
            href="/sessions/new"
            className={`training-mode-card training-mode-card-link ${
              trainingMode === "full" ? "training-mode-card-active" : ""
            }`}
          >
            <div
              className={`training-mode-card-badge ${
                trainingMode === "full" ? "training-mode-card-badge-active" : ""
              }`}
            >
              {trainingMode === "full" ? "Actif" : "Disponible"}
            </div>
            <div className="training-mode-card-icon" aria-hidden="true">
              📞
            </div>
            <h3 className="training-mode-card-title">Appel complet</h3>
            <p className="training-mode-card-desc">
              Le cold call de bout en bout, sans filet, comme dans la vraie
              vie. Débrief à la fin avec note sur 100 et reformulations
              concrètes.
            </p>
          </Link>
        </div>
      </section>

      {/* Quick Launch : disponible uniquement en mode "full" (appel
          complet). Le mode "block" exige de choisir un bloc précis,
          le Quick Launch n'a pas de sens. */}
      {trainingMode === "full" && (
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

      {/* Configuration sur mesure : la plus puissante */}
      <section className="space-y-5">
        <div>
          <div className="eyebrow" style={{ color: "#b495ff" }}>
            {trainingMode === "block"
              ? "Configuration du coaching ciblé"
              : "Configuration sur mesure"}
          </div>
          <h2 className="text-h3 mt-1">
            {trainingMode === "block"
              ? "Choisis ton client et ton bloc à travailler."
              : "Choisis chaque paramètre."}
          </h2>
          <p
            className="text-small mt-1"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            {trainingMode === "block"
              ? "Tu vas démarrer DIRECTEMENT au bloc choisi. Le scoring final se concentre sur les critères de ce bloc, pas sur l'appel entier."
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
        />
      </section>
    </div>
  );
}
