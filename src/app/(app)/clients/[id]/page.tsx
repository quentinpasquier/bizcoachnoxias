import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge, DifficultyBadge, ScoreBadge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import type { Client, PersonaProfile, SessionRow } from "@/lib/supabase/types";
import { formatRelativeFr } from "@/lib/format";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clientData }, { data: sessionsData }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase
      .from("sessions")
      .select("*")
      .eq("client_id", id)
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  if (!clientData) notFound();
  const client = clientData as Client;
  const sessions = (sessionsData ?? []) as SessionRow[];
  const personas = (client.persona_profiles ?? []) as PersonaProfile[];

  const completed = sessions.filter((s) => s.status === "completed");
  const avgScore =
    completed.length > 0
      ? Math.round(
          completed.reduce((acc, s) => acc + (s.score ?? 0), 0) /
            completed.length,
        )
      : null;
  const rdvSecured = completed.filter((s) => s.appointment_secured).length;

  return (
    <div className="container-noxias py-10 space-y-8">
      <div>
        <Link
          href="/clients"
          className="text-small hover:underline"
          style={{ color: "var(--color-gray)" }}
        >
          ← Retour aux clients
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="divider-green block mb-3" />
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-h2">{client.name}</h1>
            {!client.active && <Badge tone="neutral">Inactif</Badge>}
          </div>
          {client.sector && (
            <p
              className="text-meta uppercase tracking-widest mt-2"
              style={{ color: "var(--color-gray)" }}
            >
              {client.sector}
            </p>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href={`/clients/${id}/edit`} className="btn btn-ghost">
            Éditer le client
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatBox label="Sessions terminées" value={completed.length.toString()} />
        <StatBox
          label="Score moyen"
          value={avgScore !== null ? `${avgScore}` : "—"}
          suffix={avgScore !== null ? "/100" : undefined}
        />
        <StatBox
          label="RDV obtenus"
          value={rdvSecured.toString()}
          suffix={completed.length > 0 ? `/ ${completed.length}` : undefined}
        />
      </div>

      {/* PERSONAS — section principale, c'est par ici qu'on lance les appels */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-h3">Personas à appeler</h2>
            <p
              className="text-small mt-1"
              style={{ color: "var(--color-gray)" }}
            >
              Chaque carte = un type de prospect avec son brief de préparation.
              Clique « Lancer l'appel » pour démarrer une simulation.
            </p>
          </div>
        </div>

        {personas.length === 0 ? (
          <Card variant="lavender" className="text-center py-10">
            <p
              className="text-body mb-4"
              style={{ color: "var(--color-gray)" }}
            >
              Aucun persona n'a encore été extrait. Réuploade des docs depuis
              l'éditeur ou ajoute-les manuellement.
            </p>
            <Link
              href={`/clients/${id}/edit`}
              className="btn btn-primary inline-flex"
            >
              Ajouter des docs
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {personas.map((p) => (
              <PersonaCard key={p.id} persona={p} clientId={id} />
            ))}
          </div>
        )}
      </section>

      {/* Infos client (en bas, moins prioritaire) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {client.description && (
          <Card>
            <SectionLabel>Description</SectionLabel>
            <p className="text-body" style={{ color: "var(--color-dark)" }}>
              {client.description}
            </p>
          </Card>
        )}
        {client.value_proposition && (
          <Card>
            <SectionLabel>Value proposition</SectionLabel>
            <p className="text-body" style={{ color: "var(--color-dark)" }}>
              {client.value_proposition}
            </p>
          </Card>
        )}
        <Card className={!(client.description && client.value_proposition) ? "md:col-span-2" : ""}>
          <SectionLabel>Pitch à porter</SectionLabel>
          <p className="text-body" style={{ color: "var(--color-dark)" }}>
            {client.product_pitch}
          </p>
        </Card>
        {client.synced_files && client.synced_files.length > 0 && (
          <Card className="md:col-span-2">
            <SectionLabel>Documents source</SectionLabel>
            <ul className="space-y-1 mt-2">
              {client.synced_files.map((f) => (
                <li
                  key={f.filename}
                  className="text-small flex items-center gap-2"
                >
                  <span className="text-meta uppercase tracking-widest" style={{ color: "var(--color-gray)" }}>
                    {f.kind}
                  </span>
                  <span style={{ color: "var(--color-dark)" }}>{f.filename}</span>
                  <span className="text-meta" style={{ color: "var(--color-gray)" }}>
                    · {Math.round(f.size / 1024)} kB
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Historique sessions de ce client */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h3">Sessions récentes</h2>
        </div>
        {sessions.length === 0 ? (
          <Card variant="lavender" className="text-center py-8">
            <p className="text-body" style={{ color: "var(--color-gray)" }}>
              Aucune session pour ce client pour le moment.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={
                  s.status === "active"
                    ? `/sessions/${s.id}`
                    : `/sessions/${s.id}/feedback`
                }
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer mb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-h4">{s.persona_label}</span>
                        <DifficultyBadge difficulty={s.difficulty} />
                        {s.status === "active" && (
                          <Badge tone="success">En cours</Badge>
                        )}
                        {s.appointment_secured && (
                          <Badge tone="success">✓ RDV</Badge>
                        )}
                      </div>
                      <p
                        className="text-small mt-1"
                        style={{ color: "var(--color-gray)" }}
                      >
                        {formatRelativeFr(s.started_at)}
                      </p>
                    </div>
                    <ScoreBadge score={s.score} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PersonaCard({
  persona,
  clientId,
}: {
  persona: PersonaProfile;
  clientId: string;
}) {
  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-h4">{persona.label}</h3>
          {persona.role && (
            <p
              className="text-small mt-1"
              style={{ color: "var(--color-gray)" }}
            >
              {persona.role}
            </p>
          )}
        </div>
      </div>

      {persona.typical_company && (
        <p
          className="text-meta uppercase tracking-widest mt-1 mb-3"
          style={{ color: "var(--color-gray)" }}
        >
          {persona.typical_company}
        </p>
      )}

      {persona.prep_briefing && (
        <div className="mb-4">
          <SectionLabel>Brief de préparation</SectionLabel>
          <p
            className="text-small mt-1 whitespace-pre-line"
            style={{ color: "var(--color-dark)" }}
          >
            {persona.prep_briefing}
          </p>
        </div>
      )}

      {persona.key_pains.length > 0 && (
        <div className="mb-3">
          <SectionLabel>Douleurs clés</SectionLabel>
          <ul className="text-small mt-1 space-y-0.5">
            {persona.key_pains.slice(0, 3).map((p, i) => (
              <li
                key={i}
                className="flex gap-2"
                style={{ color: "var(--color-dark)" }}
              >
                <span style={{ color: "var(--color-red)" }}>—</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {persona.key_kpis.length > 0 && (
        <div className="mb-3">
          <SectionLabel>KPIs surveillés</SectionLabel>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {persona.key_kpis.map((k, i) => (
              <span
                key={i}
                className="badge"
                style={{
                  background: "rgba(74, 143, 231, 0.16)",
                  color: "#1F4A88",
                }}
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {persona.main_objections.length > 0 && (
        <details className="mb-3">
          <summary
            className="text-meta uppercase tracking-widest cursor-pointer"
            style={{ color: "var(--color-gray)" }}
          >
            Objections principales ({persona.main_objections.length})
          </summary>
          <ul className="text-small mt-2 space-y-1">
            {persona.main_objections.map((o, i) => (
              <li
                key={i}
                className="flex gap-2"
                style={{ color: "var(--color-dark)" }}
              >
                <span style={{ color: "var(--color-warning)" }}>—</span>
                <span>« {o} »</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {persona.decision_signals && (
        <div className="mb-4">
          <SectionLabel>Ce qui le fait dire OUI</SectionLabel>
          <p
            className="text-small mt-1"
            style={{ color: "var(--color-dark)" }}
          >
            {persona.decision_signals}
          </p>
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-[rgba(139,127,163,0.16)]">
        <Link
          href={`/sessions/new?client=${clientId}&persona=${encodeURIComponent(persona.label)}`}
          className="btn btn-primary w-full"
        >
          Lancer l'appel →
        </Link>
      </div>
    </Card>
  );
}

function StatBox({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <Card>
      <div
        className="font-display"
        style={{
          fontSize: "3rem",
          lineHeight: "1",
          color: "var(--color-purple)",
        }}
      >
        {value}
        {suffix && (
          <span
            style={{
              fontSize: "1rem",
              opacity: 0.5,
              marginLeft: "0.25rem",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      <div
        className="text-meta uppercase tracking-widest mt-2"
        style={{ color: "var(--color-gray)" }}
      >
        {label}
      </div>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-meta uppercase tracking-widest"
      style={{ color: "var(--color-gray)" }}
    >
      {children}
    </div>
  );
}
