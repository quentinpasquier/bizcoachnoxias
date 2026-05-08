import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge, DifficultyBadge, ScoreBadge } from "@/components/ui/Badge";
import { StatusPill } from "@/components/ui/Status";
import { createClient } from "@/lib/supabase/server";
import type { Client, PersonaProfile, SessionRow } from "@/lib/supabase/types";
import { formatDateTimeFr } from "@/lib/format";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: clientData },
    { data: sessionsData },
    { data: profilesData },
    {
      data: { user: currentUser },
    },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase
      .from("sessions")
      .select("*")
      .eq("client_id", id)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase.from("profiles").select("id, full_name"),
    supabase.auth.getUser(),
  ]);

  if (!clientData) notFound();
  const client = clientData as Client;
  const sessions = (sessionsData ?? []) as SessionRow[];
  const personas = (client.persona_profiles ?? []) as PersonaProfile[];
  const profileById = new Map(
    ((profilesData ?? []) as { id: string; full_name: string | null }[]).map(
      (p) => [p.id, p.full_name ?? "Anonyme"],
    ),
  );
  const myUserId = currentUser?.id ?? null;

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
    <div className="container-noxias py-10 space-y-12 max-w-6xl">
      <Link
        href="/clients"
        className="text-small inline-flex items-center gap-1.5"
        style={{ color: "var(--color-gray)" }}
      >
        ← Tous les clients
      </Link>

      {/* HERO style Onboarding */}
      <header className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-start">
        <div>
          <div className="eyebrow-green mb-3">PROSPECTION CLIENT</div>
          <h1
            className="text-h1"
            style={{
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              lineHeight: "1.05",
            }}
          >
            <span style={{ color: "var(--color-dark)" }}>Coach pour</span>
            <br />
            <span style={{ color: "var(--color-green)" }}>{client.name}</span>
          </h1>
          {client.value_proposition ? (
            <p
              className="text-body-l mt-5 max-w-2xl"
              style={{ color: "var(--color-gray)" }}
            >
              {client.value_proposition}
            </p>
          ) : (
            <p
              className="text-body-l mt-5 max-w-2xl"
              style={{ color: "var(--color-gray)" }}
            >
              {client.product_pitch}
            </p>
          )}
          <div className="flex items-center gap-3 mt-6 flex-wrap">
            {client.sector && (
              <span
                className="text-small font-medium"
                style={{ color: "var(--color-purple)" }}
              >
                {client.sector}
              </span>
            )}
            {!client.active && <Badge tone="neutral">Inactif</Badge>}
            {client.synced_files && client.synced_files.length > 0 && (
              <span className="text-small" style={{ color: "var(--color-gray)" }}>
                · {client.synced_files.length} document
                {client.synced_files.length > 1 ? "s" : ""} source
                {client.synced_files.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          <Link href={`/clients/${id}/edit`} className="btn btn-ghost">
            Éditer
          </Link>
        </div>
      </header>

      {/* PERSONAS */}
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-h2" style={{ fontSize: "2rem" }}>
              Personas
            </h2>
            <p
              className="text-small mt-1"
              style={{ color: "var(--color-gray)" }}
            >
              {personas.length}{" "}
              {personas.length > 1 ? "profils" : "profil"} prêts à appeler
            </p>
          </div>
        </div>

        {personas.length === 0 ? (
          <Card variant="lavender" className="text-center py-12">
            <p
              className="text-body mb-4"
              style={{ color: "var(--color-gray)" }}
            >
              Aucun persona n&apos;a été extrait. Réuploade des docs ou ajoute-les
              manuellement.
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

      {/* STATS du client */}
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

      {/* INFOS COMPLÉMENTAIRES */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {client.description && (
          <Card>
            <div className="eyebrow mb-2">Description</div>
            <p className="text-body" style={{ color: "var(--color-dark)" }}>
              {client.description}
            </p>
          </Card>
        )}
        <Card className={!client.description ? "md:col-span-2" : ""}>
          <div className="eyebrow mb-2">Pitch à porter</div>
          <p className="text-body" style={{ color: "var(--color-dark)" }}>
            {client.product_pitch}
          </p>
        </Card>
        {client.synced_files && client.synced_files.length > 0 && (
          <Card className="md:col-span-2">
            <div className="eyebrow mb-3">Documents source</div>
            <ul className="space-y-2">
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
          <Card variant="lavender" className="text-center py-10">
            <p style={{ color: "var(--color-gray)" }}>
              Aucune session pour ce client.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const author = profileById.get(s.user_id) ?? "Anonyme";
              const isMe = s.user_id === myUserId;
              return (
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
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-h4">{s.persona_label}</span>
                          <DifficultyBadge difficulty={s.difficulty} />
                          {s.status === "active" && (
                            <StatusPill tone="success">En cours</StatusPill>
                          )}
                          {s.appointment_secured && (
                            <StatusPill tone="success">RDV</StatusPill>
                          )}
                          {isMe && (
                            <span
                              className="badge"
                              style={{
                                background: "rgba(60, 200, 121, 0.10)",
                                color: "#1F6A3F",
                              }}
                            >
                              Toi
                            </span>
                          )}
                        </div>
                        <p
                          className="text-small mt-1"
                          style={{ color: "var(--color-gray)" }}
                        >
                          <span style={{ color: "var(--color-dark)", fontWeight: 500 }}>
                            {author}
                          </span>
                          {" · "}
                          {formatDateTimeFr(s.started_at)}
                        </p>
                      </div>
                      <ScoreBadge score={s.score} />
                    </div>
                  </Card>
                </Link>
              );
            })}
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
  const briefingPreview = persona.prep_briefing
    ? persona.prep_briefing.length > 220
      ? persona.prep_briefing.slice(0, 200).trim() + "..."
      : persona.prep_briefing
    : "";

  return (
    <Card className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-1.5">{persona.label}</div>
          <h3 className="text-h3" style={{ fontSize: "1.5rem" }}>
            {persona.role || persona.label}
          </h3>
          {persona.typical_company && (
            <p
              className="text-small mt-1.5"
              style={{ color: "var(--color-gray)" }}
            >
              {persona.typical_company}
            </p>
          )}
        </div>
      </div>

      {/* Brief preview */}
      {briefingPreview && (
        <div
          className="rounded-md p-4 mb-4"
          style={{
            background: "var(--color-lavender)",
            border: "1px solid rgba(52, 36, 75, 0.04)",
          }}
        >
          <div className="eyebrow-green mb-2">Brief</div>
          <p
            className="text-small"
            style={{ color: "var(--color-dark)", lineHeight: "1.5" }}
          >
            {briefingPreview}
          </p>
        </div>
      )}

      {/* Pains + KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <div className="stat-tile">
          <div
            className="text-meta uppercase tracking-widest font-semibold"
            style={{ color: "var(--color-gray)", fontSize: "0.6875rem" }}
          >
            Douleurs clés
          </div>
          <div
            className="font-display mt-1"
            style={{
              fontSize: "1.5rem",
              color: "var(--color-red)",
              lineHeight: "1",
            }}
          >
            {persona.key_pains.length}
          </div>
        </div>
        <div className="stat-tile">
          <div
            className="text-meta uppercase tracking-widest font-semibold"
            style={{ color: "var(--color-gray)", fontSize: "0.6875rem" }}
          >
            Objections
          </div>
          <div
            className="font-display mt-1"
            style={{
              fontSize: "1.5rem",
              color: "var(--color-warning)",
              lineHeight: "1",
            }}
          >
            {persona.main_objections.length}
          </div>
        </div>
      </div>

      {/* Détails déroulables */}
      <details className="mb-4 group">
        <summary
          className="text-small font-semibold cursor-pointer flex items-center gap-2 select-none"
          style={{ color: "var(--color-purple)" }}
        >
          <span
            className="transition-transform group-open:rotate-90 inline-block"
            aria-hidden="true"
          >
            ›
          </span>
          <span>Voir tous les détails</span>
        </summary>
        <div className="mt-4 space-y-4 pl-4">
          {persona.key_pains.length > 0 && (
            <div>
              <div className="eyebrow mb-2">Douleurs clés</div>
              <ul className="text-small space-y-1.5">
                {persona.key_pains.map((p, i) => (
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
              <div className="eyebrow mb-2">KPIs surveillés</div>
              <div className="flex flex-wrap gap-1.5">
                {persona.key_kpis.map((k, i) => (
                  <span
                    key={i}
                    className="badge"
                    style={{
                      background: "rgba(74, 143, 231, 0.10)",
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
            <div>
              <div className="eyebrow mb-2">Objections principales</div>
              <ul className="text-small space-y-1.5">
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
            </div>
          )}
          {persona.decision_signals && (
            <div>
              <div className="eyebrow mb-2">Ce qui le fait dire OUI</div>
              <p
                className="text-small"
                style={{ color: "var(--color-dark)" }}
              >
                {persona.decision_signals}
              </p>
            </div>
          )}
        </div>
      </details>

      {/* CTA */}
      <div
        className="mt-auto pt-4 border-t"
        style={{ borderColor: "var(--color-gray-border)" }}
      >
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
      <div className="eyebrow">{label}</div>
      <div
        className="font-display mt-2"
        style={{
          fontSize: "2.25rem",
          lineHeight: "1",
          color: "var(--color-dark)",
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
