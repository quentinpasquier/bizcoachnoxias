import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge, DifficultyBadge, ScoreBadge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import type { Client, SessionRow } from "@/lib/supabase/types";
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
          <Link
            href={`/clients/${id}/edit`}
            className="btn btn-ghost"
          >
            Modifier
          </Link>
          {client.active && (
            <Link
              href={`/sessions/new?client=${id}`}
              className="btn btn-primary"
            >
              Démarrer une session →
            </Link>
          )}
        </div>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

        <Card className={client.description && client.value_proposition ? "" : "md:col-span-2"}>
          <SectionLabel>Pitch à porter</SectionLabel>
          <p className="text-body" style={{ color: "var(--color-dark)" }}>
            {client.product_pitch}
          </p>
        </Card>

        {client.ideal_targets && (
          <Card>
            <SectionLabel>Cibles idéales</SectionLabel>
            <p className="text-body" style={{ color: "var(--color-dark)" }}>
              {client.ideal_targets}
            </p>
          </Card>
        )}

        {client.typical_objections?.length > 0 && (
          <Card>
            <SectionLabel>Objections classiques</SectionLabel>
            <ul className="space-y-2">
              {client.typical_objections.map((obj, i) => (
                <li
                  key={i}
                  className="text-small flex gap-2"
                  style={{ color: "var(--color-dark)" }}
                >
                  <span style={{ color: "var(--color-red)" }}>—</span>
                  <span>« {obj} »</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h3">Sessions récentes pour ce client</h2>
          {sessions.length > 0 && (
            <Link
              href={`/sessions/new?client=${id}`}
              className="text-small font-medium hover:underline"
              style={{ color: "var(--color-purple)" }}
            >
              + Nouvelle session
            </Link>
          )}
        </div>

        {sessions.length === 0 ? (
          <Card variant="lavender" className="text-center py-10">
            <p className="text-body mb-4" style={{ color: "var(--color-gray)" }}>
              Aucune session pour ce client pour le moment.
            </p>
            {client.active && (
              <Link
                href={`/sessions/new?client=${id}`}
                className="btn btn-primary inline-flex"
              >
                Démarrer la première
              </Link>
            )}
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
      className="text-meta uppercase tracking-widest mb-2"
      style={{ color: "var(--color-gray)" }}
    >
      {children}
    </div>
  );
}
