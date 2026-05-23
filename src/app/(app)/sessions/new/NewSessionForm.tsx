"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { VoiceOrb } from "@/components/VoiceOrb";
import { CoachTip } from "@/components/CoachTip";
import { getPersonaBullets } from "@/lib/briefing";
import type { Difficulty, Gender, PersonaProfile } from "@/lib/supabase/types";

interface ClientOption {
  id: string;
  name: string;
  sector: string | null;
  value_proposition: string | null;
  product_pitch: string;
  target_personas: string[];
  persona_profiles: PersonaProfile[];
  has_docs: boolean;
}

interface DifficultyOption {
  key: string;
  label: string;
  description: string;
}

const DIFFICULTY_INTENSITY: Record<string, number> = {
  debutant: 1,
  intermediaire: 2,
  avance: 3,
  expert: 4,
};

interface Props {
  clients: ClientOption[];
  preselectedClientId: string;
  preselectedPersonaLabel: string;
  difficulties: DifficultyOption[];
}

export function NewSessionForm({
  clients,
  preselectedClientId,
  preselectedPersonaLabel,
  difficulties,
}: Props) {
  const router = useRouter();

  const [clientId, setClientId] = useState(
    preselectedClientId || clients[0]?.id || "",
  );
  const selectedClient = clients.find((c) => c.id === clientId);
  const personaOptions = useMemo(
    () =>
      selectedClient?.target_personas?.length
        ? selectedClient.target_personas
        : (selectedClient?.persona_profiles ?? []).map((p) => p.label),
    [selectedClient],
  );

  const [personaLabel, setPersonaLabel] = useState(
    preselectedPersonaLabel || personaOptions[0] || "",
  );
  const selectedProfile = selectedClient?.persona_profiles.find(
    (p) => p.label === personaLabel,
  );

  const [gender, setGender] = useState<Gender>("homme");
  const [difficulty, setDifficulty] = useState<Difficulty>("debutant");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Timer pendant la génération du scénario (5-10s typique)
  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const start = performance.now();
    const id = setInterval(() => {
      setElapsed((performance.now() - start) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [loading]);

  function handleClientChange(id: string) {
    setClientId(id);
    const c = clients.find((c) => c.id === id);
    const opts =
      c?.target_personas?.length
        ? c.target_personas
        : (c?.persona_profiles ?? []).map((p) => p.label);
    setPersonaLabel(opts[0] ?? "");
  }

  // Stepper : 4 steps, 1 = client, 2 = persona, 3 = niveau, 4 = genre
  const completedSteps =
    (clientId ? 1 : 0) +
    (personaLabel ? 1 : 0) +
    (difficulty ? 1 : 0) +
    (gender ? 1 : 0);

  const ready = clientId && personaLabel && difficulty && gender;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) return setError("Choisis un client.");
    if (!personaLabel.trim()) {
      return setError("Aucun persona disponible. Uploade des docs sur ce client.");
    }
    setLoading(true);

    const res = await fetch("/api/sessions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        difficulty,
        gender,
        personaLabel: personaLabel.trim(),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Impossible de démarrer la session.");
      setLoading(false);
      return;
    }

    const { sessionId } = await res.json();
    router.push(`/sessions/${sessionId}/briefing`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
        {/* MAIN COLUMN, les étapes */}
        <div className="space-y-8 min-w-0">
          {/* STEPPER */}
          <Stepper completed={completedSteps} total={4} />

          {/* Conseil du coach */}
          <CoachTip collapsible defaultOpen={false}>
            Conseil tactique : ne saute pas les niveaux.{" "}
            <strong style={{ color: "#FFFFFF" }}>
              3 sessions Débutant sur le même persona
            </strong>{" "}
            pour caler ton opener et ton pitch (objectif : décrocher 2 RDV
            d&apos;affilée). Passe Intermédiaire quand t&apos;as compris la
            mécanique. Avancé = prospect retors. Expert = simulation gros
            compte. Travailler en alternant les niveaux casse
            l&apos;apprentissage —{" "}
            <strong style={{ color: "#FFFFFF" }}>
              un persona à fond pendant 5-10 sessions
            </strong>{" "}
            est plus efficace que zapper tous les jours. Stat Gong : un
            commercial qui répète le même call pattern dépasse la baseline
            industrie en 3-4 semaines.
          </CoachTip>

          {/* Étape 1 : Client */}
          <StepSection
            number="01"
            title="Tu prospectes pour..."
            subtitle={`${clients.length} client${clients.length > 1 ? "s" : ""} dans ton arsenal`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clients.map((c) => (
                <SelectableCard
                  key={c.id}
                  selected={clientId === c.id}
                  onClick={() => handleClientChange(c.id)}
                  warningBadge={!c.has_docs ? "Pas de docs" : undefined}
                >
                  <div className="text-h4">{c.name}</div>
                  {c.sector && <div className="eyebrow mt-1">{c.sector}</div>}
                  {c.value_proposition && (
                    <p
                      className="text-small mt-2 line-clamp-2"
                      style={{ color: "#FFFFFF" }}
                    >
                      {c.value_proposition}
                    </p>
                  )}
                </SelectableCard>
              ))}
            </div>
          </StepSection>

          {/* Étape 2 : Persona, dépend du client */}
          {selectedClient && (
            <StepSection
              number="02"
              title="Tu vas appeler..."
              subtitle={
                personaOptions.length === 0
                  ? "Aucun persona pour ce client"
                  : `${personaOptions.length} persona${personaOptions.length > 1 ? "s" : ""} dispo pour ${selectedClient.name}`
              }
            >
              {personaOptions.length === 0 ? (
                <Card variant="lavender">
                  <p style={{ color: "rgba(255, 255, 255, 0.65)" }}>
                    Aucun persona n&apos;a été extrait pour ce client. Uploade
                    des docs ou ajoute-les manuellement dans la fiche client.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {personaOptions.map((p) => {
                    const profile = selectedClient.persona_profiles.find(
                      (pp) => pp.label === p,
                    );
                    return (
                      <SelectableCard
                        key={p}
                        selected={personaLabel === p}
                        onClick={() => setPersonaLabel(p)}
                      >
                        <div className="text-h4">{p}</div>
                        {profile?.role && (
                          <p
                            className="text-small mt-1"
                            style={{ color: "rgba(255, 255, 255, 0.65)" }}
                          >
                            {profile.role}
                          </p>
                        )}
                        {profile?.typical_company && (
                          <p
                            className="text-meta mt-1"
                            style={{ color: "rgba(255, 255, 255, 0.65)" }}
                          >
                            {profile.typical_company}
                          </p>
                        )}
                      </SelectableCard>
                    );
                  })}
                </div>
              )}

            </StepSection>
          )}

          {/* Étape 3 : Niveau */}
          <StepSection
            number="03"
            title="Tu veux quel niveau ?"
            subtitle="Plus c'est haut, plus le prospect te fait suer"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {difficulties.map((d) => {
                const intensity = DIFFICULTY_INTENSITY[d.key] ?? 1;
                return (
                  <SelectableCard
                    key={d.key}
                    selected={difficulty === d.key}
                    onClick={() => setDifficulty(d.key as Difficulty)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-h4">{d.label}</div>
                      <DifficultyBars intensity={intensity} />
                    </div>
                    <p
                      className="text-small"
                      style={{ color: "rgba(255, 255, 255, 0.65)" }}
                    >
                      {d.description}
                    </p>
                  </SelectableCard>
                );
              })}
            </div>
          </StepSection>

          {/* Étape 4 : Genre */}
          <StepSection
            number="04"
            title="Un homme ou une femme ?"
            subtitle="J'adapte le nom et le ton"
          >
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {(["homme", "femme"] as Gender[]).map((g) => (
                <SelectableCard
                  key={g}
                  selected={gender === g}
                  onClick={() => setGender(g)}
                  compact
                >
                  <div className="text-h4 capitalize">{g}</div>
                </SelectableCard>
              ))}
            </div>
          </StepSection>
        </div>

        {/* SIDEBAR : avatar du prospect en cours de composition */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <AvatarCard
            clientName={selectedClient?.name ?? null}
            personaLabel={personaLabel || null}
            personaRole={selectedProfile?.role ?? null}
            personaProfile={selectedProfile ?? null}
            gender={gender}
            difficultyLabel={
              difficulties.find((d) => d.key === difficulty)?.label ?? ""
            }
            difficultyIntensity={
              (DIFFICULTY_INTENSITY[difficulty] ?? 1) as 1 | 2 | 3 | 4
            }
            ready={Boolean(ready)}
          />
        </aside>
      </div>

      {/* BOUTON DE LANCEMENT EN BAS DE PAGE */}
      <LaunchBar
        ready={Boolean(ready)}
        clientName={selectedClient?.name ?? null}
        personaLabel={personaLabel || null}
        difficultyLabel={
          difficulties.find((d) => d.key === difficulty)?.label ?? ""
        }
        gender={gender}
        loading={loading}
        elapsed={elapsed}
        error={error}
        onLaunch={handleSubmit}
      />
    </form>
  );
}

function Stepper({ completed, total }: { completed: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="rounded-pill transition-all"
            style={{
              width: i < completed ? "32px" : "12px",
              height: "8px",
              background:
                i < completed
                  ? "var(--color-green)"
                  : "rgba(139, 127, 163, 0.24)",
            }}
          />
        ))}
      </div>
      <span
        className="text-small font-semibold"
        style={{ color: "rgba(255, 255, 255, 0.65)" }}
      >
        {completed}/{total} étapes
      </span>
    </div>
  );
}

function StepSection({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span
          className=""
          style={{
            fontSize: "2.5rem",
            lineHeight: "1",
            color: "var(--color-green)",
          }}
        >
          {number}
        </span>
        <div>
          <h2 className="text-h3">{title}</h2>
          {subtitle && (
            <p
              className="text-small mt-0.5"
              style={{ color: "rgba(255, 255, 255, 0.65)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function SelectableCard({
  selected,
  onClick,
  children,
  warningBadge,
  compact = false,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  warningBadge?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`selectable-card ${selected ? "selectable-card-selected" : ""}`}
      style={{
        padding: compact ? "16px 20px" : "20px",
      }}
    >
      {/* Checkmark when selected */}
      {selected && (
        <span
          className="absolute top-3 right-3 inline-flex items-center justify-center rounded-pill"
          style={{
            width: "24px",
            height: "24px",
            background: "var(--color-green)",
            color: "#FFFFFF",
          }}
          aria-hidden="true"
        >
          <CheckIcon size={14} />
        </span>
      )}

      {/* Warning badge if any */}
      {warningBadge && !selected && (
        <span
          className="absolute top-3 right-3 badge"
          style={{
            background: "rgba(245, 165, 36, 0.22)",
            color: "#F5A524",
          }}
        >
          {warningBadge}
        </span>
      )}

      {children}
    </button>
  );
}

function DifficultyBars({ intensity }: { intensity: number }) {
  return (
    <div className="flex items-end gap-1">
      {[1, 2, 3, 4].map((level) => (
        <span
          key={level}
          className="rounded-sm"
          style={{
            width: "6px",
            height: `${level * 4 + 4}px`,
            background:
              level <= intensity
                ? intensity >= 4
                  ? "var(--color-red)"
                  : intensity >= 3
                    ? "var(--color-warning)"
                    : "var(--color-green)"
                : "rgba(139, 127, 163, 0.24)",
          }}
        />
      ))}
    </div>
  );
}

function AvatarCard({
  ready,
  clientName,
  personaLabel,
  personaRole,
  personaProfile,
  gender,
  difficultyLabel,
  difficultyIntensity,
}: {
  ready: boolean;
  clientName: string | null;
  personaLabel: string | null;
  personaRole: string | null;
  personaProfile: PersonaProfile | null;
  gender: Gender;
  difficultyLabel: string;
  difficultyIntensity: 1 | 2 | 3 | 4;
}) {
  const composing =
    [clientName, personaLabel, difficultyLabel].filter(Boolean).length > 0;
  const bullets = personaProfile ? getPersonaBullets(personaProfile) : [];

  return (
    <div
      className="rounded-xl p-6 transition-all"
      style={{
        background: ready
          ? "linear-gradient(140deg, rgba(60, 200, 121, 0.16) 0%, rgba(34, 25, 50, 0.5) 100%)"
          : "rgba(255, 255, 255, 0.05)",
        color: "#FFFFFF",
        border: ready
          ? "1px solid rgba(60, 200, 121, 0.4)"
          : "1px solid rgba(255, 255, 255, 0.10)",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        boxShadow: ready
          ? "0 18px 40px rgba(60, 200, 121, 0.18)"
          : "0 4px 14px rgba(11, 6, 22, 0.32)",
      }}
    >
      <div
        className="text-meta uppercase tracking-widest mb-4 text-center"
        style={{
          color: "rgba(255,255,255,0.55)",
        }}
      >
        {ready ? "Ton prospect est prêt" : "Compose ton prospect"}
      </div>

      {/* AVATAR ORB */}
      <div className="flex justify-center mb-5">
        <VoiceOrb
          state={composing ? "idle" : "ended"}
          size={160}
          intensity={difficultyIntensity}
        />
      </div>

      {/* IDENTITÉ DU PROSPECT EN COURS */}
      <div className="text-center mb-5">
        <div
          className="text-h4"
          style={{ color: ready ? "#FFFFFF" : "var(--color-dark)" }}
        >
          {personaLabel ?? "Persona"}
        </div>
        {personaRole && (
          <div
            className="text-small mt-1"
            style={{
              color: ready
                ? "rgba(255,255,255,0.65)"
                : "var(--color-gray)",
            }}
          >
            {personaRole}
          </div>
        )}
      </div>

      {/* TAGS */}
      <div className="space-y-2.5">
        <AvatarTag
          icon="🏢"
          label="Client"
          value={clientName}
          dark={ready}
        />
        <AvatarTag
          icon="👤"
          label="Genre"
          value={gender ? (gender === "homme" ? "Homme" : "Femme") : null}
          dark={ready}
        />
        <AvatarTag
          icon="⚡"
          label="Difficulté"
          value={difficultyLabel || null}
          dark={ready}
          extra={
            difficultyLabel ? (
              <DifficultyBarsLarge
                intensity={difficultyIntensity}
                dark={ready}
              />
            ) : undefined
          }
        />
      </div>

      {/* BRIEF EN BULLETS, visible quand un persona est sélectionné */}
      {bullets.length > 0 && (
        <div
          className="mt-5 pt-5 border-t"
          style={{
            borderColor: ready
              ? "rgba(255,255,255,0.10)"
              : "var(--color-gray-border)",
          }}
        >
          <div
            className="text-meta uppercase tracking-widest mb-3 font-bold"
            style={{
              color: "var(--color-green)",
              fontSize: "0.6875rem",
            }}
          >
            Ta mission, si tu l&apos;acceptes
          </div>
          <ul className="space-y-2.5">
            {bullets.map((b, i) => (
              <li
                key={i}
                className="text-small flex gap-2.5"
                style={{
                  color: ready ? "rgba(255,255,255,0.92)" : "var(--color-dark)",
                  lineHeight: "1.45",
                }}
              >
                <span
                  className="flex-shrink-0 mt-0.5 inline-flex items-center justify-center text-meta font-bold rounded-pill"
                  style={{
                    width: "18px",
                    height: "18px",
                    background: "var(--color-green)",
                    color: "#FFFFFF",
                    fontSize: "0.6875rem",
                  }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AvatarTag({
  icon,
  label,
  value,
  dark,
  extra,
}: {
  icon: string;
  label: string;
  value: string | null;
  dark: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-md px-3 py-2.5 flex items-center justify-between gap-2"
      style={{
        background: dark
          ? "rgba(255,255,255,0.06)"
          : "var(--bg-soft)",
      }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="text-meta uppercase tracking-widest"
          style={{
            color: dark ? "rgba(255,255,255,0.45)" : "var(--color-gray)",
            fontSize: "0.6875rem",
            minWidth: "70px",
          }}
        >
          {label}
        </span>
        <span
          className="text-small font-semibold truncate"
          style={{
            color: value
              ? dark
                ? "#FFFFFF"
                : "var(--color-dark)"
              : dark
                ? "rgba(255,255,255,0.3)"
                : "rgba(139, 127, 163, 0.5)",
            fontWeight: value ? 600 : 400,
          }}
        >
          {value ?? "À choisir"}
        </span>
      </div>
      {extra}
    </div>
  );
}

function LaunchBar({
  ready,
  clientName,
  personaLabel,
  difficultyLabel,
  gender,
  loading,
  elapsed,
  error,
  onLaunch,
}: {
  ready: boolean;
  clientName: string | null;
  personaLabel: string | null;
  difficultyLabel: string;
  gender: Gender;
  loading: boolean;
  elapsed: number;
  error: string | null;
  onLaunch: (e: React.FormEvent) => void;
}) {
  return (
    <div className="mt-12">
      {error && (
        <div
          className="rounded-md px-4 py-3 text-small mb-4"
          style={{
            background: "rgba(233, 75, 75, 0.08)",
            color: "var(--color-error)",
            border: "1px solid rgba(233, 75, 75, 0.24)",
          }}
        >
          {error}
        </div>
      )}

      <div
        className="rounded-xl p-6 md:p-8"
        style={{
          background: ready
            ? "linear-gradient(140deg, rgba(60, 200, 121, 0.16) 0%, rgba(34, 25, 50, 0.65) 100%)"
            : "rgba(255, 255, 255, 0.05)",
          color: "#FFFFFF",
          border: ready
            ? "1px solid rgba(60, 200, 121, 0.40)"
            : "1px solid rgba(255, 255, 255, 0.10)",
          backdropFilter: "blur(16px) saturate(160%)",
          WebkitBackdropFilter: "blur(16px) saturate(160%)",
          boxShadow: ready
            ? "0 18px 40px rgba(60, 200, 121, 0.20)"
            : "0 4px 14px rgba(11, 6, 22, 0.30)",
          transition: "all 0.3s var(--ease-out)",
        }}
      >
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <div
              className="text-meta uppercase tracking-widest mb-2"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {ready ? "Prêt à décrocher" : "Encore quelques choix..."}
            </div>
            {ready ? (
              <p className="text-body-l" style={{ lineHeight: "1.4" }}>
                Tu vas appeler{" "}
                <b style={{ color: "var(--color-green)" }}>{personaLabel}</b>
                {" "}pour <b>{clientName}</b>, en mode{" "}
                <b style={{ color: "var(--color-green)" }}>
                  {difficultyLabel.toLowerCase()}
                </b>
                . Genre :{" "}
                <b>{gender === "homme" ? "homme" : "femme"}</b>.
              </p>
            ) : (
              <p
                className="text-body"
                style={{ color: "rgba(255, 255, 255, 0.65)" }}
              >
                Termine les 4 étapes et on attaque.
              </p>
            )}
          </div>
          <Button
            type="submit"
            variant={ready ? "primary" : "ghost"}
            size="lg"
            disabled={!ready || loading}
            loading={loading}
            onClick={onLaunch}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: "2px solid rgba(10, 31, 18, 0.25)",
                    borderTopColor: "#0A1F12",
                    animation: "launchSpin 0.8s linear infinite",
                  }}
                  aria-hidden="true"
                />
                Génération du scénario... {elapsed.toFixed(1)} s
              </span>
            ) : (
              "Lancer la mission →"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Ancienne RecapCard, remplacée par AvatarCard + LaunchBar mais conservée
// si jamais on doit y revenir. Non utilisée pour le moment.
function _UnusedRecapCard({
  ready,
  clientName,
  personaLabel,
  personaRole,
  gender,
  difficultyLabel,
  difficultyIntensity,
  onLaunch,
  loading,
  error,
}: {
  ready: boolean;
  clientName: string | null;
  personaLabel: string | null;
  personaRole: string | null;
  gender: Gender;
  difficultyLabel: string;
  difficultyIntensity: number;
  onLaunch: (e: React.FormEvent) => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div
      className="rounded-xl p-6 transition-all"
      style={{
        background: ready ? "var(--color-dark)" : "#FFFFFF",
        color: ready ? "#FFFFFF" : "var(--color-dark)",
        border: ready ? "none" : "1px solid var(--color-gray-border)",
        boxShadow: ready
          ? "0 18px 40px rgba(34, 25, 50, 0.18)"
          : "var(--shadow-sm)",
      }}
    >
      <div
        className="text-meta uppercase tracking-widest mb-4"
        style={{
          color: ready ? "rgba(255,255,255,0.55)" : "var(--color-gray)",
        }}
      >
        {ready ? "Prêt à démarrer" : "Récap session"}
      </div>

      <div className="space-y-4 mb-6">
        <RecapLine
          label="Client"
          value={clientName}
          ready={ready}
        />
        <RecapLine
          label="Persona"
          value={
            personaLabel
              ? personaRole
                ? `${personaLabel} (${personaRole})`
                : personaLabel
              : null
          }
          ready={ready}
        />
        <RecapLine
          label="Niveau"
          value={difficultyLabel || null}
          ready={ready}
          extra={
            difficultyLabel ? (
              <DifficultyBarsLarge
                intensity={difficultyIntensity}
                dark={ready}
              />
            ) : undefined
          }
        />
        <RecapLine
          label="Genre du prospect"
          value={gender ? (gender === "homme" ? "Homme" : "Femme") : null}
          ready={ready}
        />
      </div>

      <Button
        type="submit"
        variant={ready ? "primary" : "ghost"}
        size="lg"
        disabled={!ready || loading}
        loading={loading}
        onClick={onLaunch}
        fullWidth
      >
        {loading ? "Génération..." : "Lancer l'appel →"}
      </Button>

      {!ready && (
        <p
          className="text-meta mt-3 text-center"
          style={{ color: "rgba(255, 255, 255, 0.65)" }}
        >
          Complète les 4 étapes pour démarrer
        </p>
      )}

      {error && (
        <div
          className="mt-3 rounded-md px-3 py-2 text-small"
          style={{
            background: ready
              ? "rgba(233, 75, 75, 0.16)"
              : "rgba(233, 75, 75, 0.08)",
            color: ready ? "#FFCDCD" : "var(--color-error)",
            border: ready ? "none" : "1px solid rgba(233, 75, 75, 0.24)",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function RecapLine({
  label,
  value,
  ready,
  extra,
}: {
  label: string;
  value: string | null;
  ready: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="text-meta uppercase tracking-widest"
        style={{
          color: ready ? "rgba(255,255,255,0.45)" : "var(--color-gray)",
          fontSize: "0.6875rem",
        }}
      >
        {label}
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <span
          className="text-body font-semibold flex-1"
          style={{
            color: value
              ? ready
                ? "#FFFFFF"
                : "var(--color-dark)"
              : ready
                ? "rgba(255,255,255,0.35)"
                : "rgba(139, 127, 163, 0.6)",
            fontWeight: value ? 600 : 400,
          }}
        >
          {value ?? "À choisir"}
        </span>
        {extra}
      </div>
    </div>
  );
}

function DifficultyBarsLarge({
  intensity,
  dark,
}: {
  intensity: number;
  dark: boolean;
}) {
  return (
    <div className="flex items-end gap-1">
      {[1, 2, 3, 4].map((level) => (
        <span
          key={level}
          className="rounded-sm"
          style={{
            width: "6px",
            height: `${level * 4 + 6}px`,
            background:
              level <= intensity
                ? "var(--color-green)"
                : dark
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(139, 127, 163, 0.24)",
          }}
        />
      ))}
    </div>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
