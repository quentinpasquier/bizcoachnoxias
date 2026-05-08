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
      .limit(10),
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
    <div className="container-noxias py-10 space-y-12">
      <Link
        href="/clients"
        className="text-small hover:underline inline-flex items-center gap-1"
        style={{ color: "var(--color-gray)" }}
      >
        ← Tous les clients
      </Link>

      {/* HERO */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <span className="divider-green block mb-4" />
          {client.sector && <div className="section-eyebrow mb-2">{client.sector}</div>}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-h2">{client.name}</h1>
            {!client.active && <Badge tone="neutral">Inactif</Badge>}
          </div>
          {client.value_proposition && (
            <p
              className="text-body-l mt-3 max-w-2xl"
              style={{ color: "var(--color-dark)" }}
            >
              {client.value_proposition}
            </p>
          )}
        </div>
        <div className="flex gap-3 shrink-0">
          <Link href={`/clients/${id}/edit`} className="btn btn-ghost">
            Éditer
          </Link>
        </div>
      </header>

      {/* STATS */}
      <section className="grid grid-cols-3 gap-3 sm:gap-5">
        <MicroStat label="Sessions" value={completed.length.toString()} />
        <MicroStat
          label="Score moyen"
          value={avgScore !== null ? `${avgScore}` : "·"}
          suffix={avgScore !== null ? "/100" : undefined}
        />
        <MicroStat
          label="RDV obtenus"
          value={rdvSecured.toString()}
          suffix={completed.length > 0 ? `sur ${completed.length}` : undefined}
        />
      </section>

      {/* PERSONAS, point d'entrée principal vers les appels */}
      <section className="space-y-5">
        <div>
          <h2 className="text-h3">Personas à appeler</h2>
          <p
            className="text-small mt-1"
            style={{ color: "var(--color-gray)" }}
          >
            Une carte par profil. Lis le brief, puis lance l&apos;appel.
          </p>
        </div>

        {personas.length === 0 ? (
          <Card variant="lavender" className="text-center py-10">
            <p
              className="text-body mb-4"
              style={{ color: "var(--color-gray)" }}
            >
              Aucun persona n&apos;a été extrait. Réuploade des docs depuis
              l&apos;éditeur ou ajoute-les manuellement.
            </p>
            <Link
              href={`/clients/${id}/edit`}
              className="btn btn-primary inline-flex"
            >
              Ajouter des docs
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {personas.map((p) => (
              <PersonaCard key={p.id} persona={p} clientId={id} />
            ))}
          </div>
        )}
      </section>

      {/* INFOS COMPLÉMENTAIRES */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {client.description && (
          <Card>
            <SectionLabel>Description</SectionLabel>
            <p className="text-body mt-2" style={{ color: "var(--color-dark)" }}>
              {client.description}
            </p>
          </Card>
        )}
        <Card className={!client.description ? "md:col-span-2" : ""}>
          <SectionLabel>Pitch à porter</SectionLabel>
          <p className="text-body mt-2" style={{ color: "var(--color-dark)" }}>
            {client.product_pitch}
          </p>
        </Card>
        {client.synced_files && client.synced_files.length > 0 && (
          <Card className="md:col-span-2">
            <SectionLabel>Documents source</SectionLabel>
            <ul className="space-y-2 mt-3">
              {client.synced_files.map((f) => (
                <li
                  key={f.filename}
                  className="text-small flex items-center gap-3"
                >
                  <span
                    className="badge"
                    style={{
                      background: "var(--color-lavender)",
                      color: "var(--color-purple)",
                    }}
                  >
                    {f.kind.toUpperCase()}
                  </span>
                  <span style={{ color: "var(--color-dark)" }}>{f.filename}</span>
                  <span
                    className="text-meta"
                    style={{ color: "var(--color-gray)" }}
                  >
                    {Math.round(f.size / 1024)} kB
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* HISTORIQUE */}
      <section className="space-y-4">
        <h2 className="text-h3">Sessions récentes</h2>
        {sessions.length === 0 ? (
          <Card variant="lavender" className="text-center py-8">
            <p className="text-body" style={{ color: "var(--color-gray)" }}>
              Aucune session pour ce client.
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
                <Card hoverable className="mb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-h4">{s.persona_label}</span>
                        <DifficultyBadge difficulty={s.difficulty} />
                        {s.status === "active" && (
                          <Badge tone="success">En cours</Badge>
                        )}
                        {s.appointment_secured && (
                          <Badge tone="success">RDV</Badge>
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
      {/* Header persona */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="section-eyebrow mb-1">{persona.label}</div>
          <h3 className="text-h3" style={{ fontSize: "1.625rem" }}>
            {persona.role || persona.label}
          </h3>
          {persona.typical_company && (
            <p
              className="text-small mt-1"
              style={{ color: "var(--color-gray)" }}
            >
              {persona.typical_company}
            </p>
          )}
        </div>
      </div>

      {/* Brief */}
      {persona.prep_briefing && (
        <div
          className="p-4 rounded-md mb-4"
          style={{
            background: "var(--color-lavender)",
            border: "1px solid rgba(52, 36, 75, 0.06)",
          }}
        >
          <SectionLabel>Brief de préparation</SectionLabel>
          <p
            className="text-small mt-2 whitespace-pre-line"
            style={{ color: "var(--color-dark)", lineHeight: "1.5" }}
          >
            {persona.prep_briefing}
          </p>
        </div>
      )}

      {/* Pains + KPIs en deux colonnes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {persona.key_pains.length > 0 && (
          <div>
            <SectionLabel>Douleurs clés</SectionLabel>
            <ul className="text-small mt-2 space-y-1.5">
              {persona.key_pains.slice(0, 3).map((p, i) => (
                <li
                  key={i}
                  className="flex gap-2"
                  style={{ color: "var(--color-dark)" }}
                >
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-pill flex-shrink-0"
                    style={{ background: "var(--color-red)" }}
                    aria-hidden="true"
                  />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {persona.key_kpis.length > 0 && (
          <div>
            <SectionLabel>KPIs surveillés</SectionLabel>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {persona.key_kpis.map((k, i) => (
                <span
                  key={i}
                  className="badge"
                  style={{
                    background: "rgba(74, 143, 231, 0.12)",
                    color: "#1F4A88",
                  }}
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Objections collapsible */}
      {persona.main_objections.length > 0 && (
        <details className="mb-4 group">
          <summary
            className="text-small font-medium cursor-pointer flex items-center gap-2 select-none"
            style={{ color: "var(--color-purple)" }}
          >
            <span
              className="transition-transform group-open:rotate-90"
              aria-hidden="true"
            >
              ›
            </span>
            <span>Objections principales ({persona.main_objections.length})</span>
          </summary>
          <ul className="text-small mt-3 space-y-1.5 pl-4">
            {persona.main_objections.map((o, i) => (
              <li
                key={i}
                className="flex gap-2"
                style={{ color: "var(--color-dark)" }}
              >
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-pill flex-shrink-0"
                  style={{ background: "var(--color-warning)" }}
                  aria-hidden="true"
                />
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
            className="text-small mt-2"
            style={{ color: "var(--color-dark)" }}
          >
            {persona.decision_signals}
          </p>
        </div>
      )}

      {/* CTA bottom */}
      <div className="mt-auto pt-4 border-t" style={{ borderColor: "var(--color-gray-border)" }}>
        <Link
          href={`/sessions/new?client=${clientId}&persona=${encodeURIComponent(persona.label)}`}
          className="btn btn-primary w-full"
        >
          Lancer l&apos;appel
        </Link>
      </div>
    </Card>
  );
}

function MicroStat({
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
      <div className="section-eyebrow">{label}</div>
      <div
        className="font-display mt-2"
        style={{
          fontSize: "2.25rem",
          lineHeight: "1",
          color: "var(--color-purple)",
        }}
      >
        {value}
        {suffix && (
          <span
            className="text-small ml-1"
            style={{ color: "var(--color-gray)", fontWeight: "normal" }}
          >
            {suffix}
          </span>
        )}
      </div>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-eyebrow">{children}</div>;
}
