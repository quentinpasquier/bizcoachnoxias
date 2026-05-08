"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
    router.push(`/sessions/${sessionId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* STEPPER */}
      <Stepper completed={completedSteps} total={4} />

      {/* Étape 1 : Client */}
      <StepSection
        number="01"
        title="Pour quel client ?"
        subtitle={`${clients.length} client${clients.length > 1 ? "s" : ""} disponible${clients.length > 1 ? "s" : ""}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  style={{ color: "var(--color-dark)" }}
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
          title="Quel prospect appelles-tu ?"
          subtitle={
            personaOptions.length === 0
              ? "Aucun persona pour ce client"
              : `${personaOptions.length} persona${personaOptions.length > 1 ? "s" : ""} pour ${selectedClient.name}`
          }
        >
          {personaOptions.length === 0 ? (
            <Card variant="lavender">
              <p style={{ color: "var(--color-gray)" }}>
                Aucun persona n&apos;a été extrait pour ce client. Uploade des
                docs ou ajoute-les manuellement dans la fiche client.
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
                        style={{ color: "var(--color-gray)" }}
                      >
                        {profile.role}
                      </p>
                    )}
                    {profile?.typical_company && (
                      <p
                        className="text-meta mt-1"
                        style={{ color: "var(--color-gray)" }}
                      >
                        {profile.typical_company}
                      </p>
                    )}
                  </SelectableCard>
                );
              })}
            </div>
          )}

          {/* Brief étendu si persona sélectionné */}
          {selectedProfile?.prep_briefing && (
            <Card
              className="mt-4"
              style={{
                background: "var(--color-lavender)",
                border: "1px solid rgba(52, 36, 75, 0.06)",
              }}
            >
              <div className="eyebrow-green mb-2">Brief de préparation</div>
              <p
                className="text-small whitespace-pre-line"
                style={{ color: "var(--color-dark)", lineHeight: "1.55" }}
              >
                {selectedProfile.prep_briefing}
              </p>
            </Card>
          )}
        </StepSection>
      )}

      {/* Étape 3 : Niveau */}
      <StepSection
        number="03"
        title="Quelle difficulté ?"
        subtitle="Plus c'est haut, plus le prospect est dur"
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
                  style={{ color: "var(--color-gray)" }}
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
        title="Genre du prospect"
        subtitle="Le scénario adaptera le nom et le ton"
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

      {/* RECAP + LAUNCH */}
      <RecapCard
        ready={Boolean(ready)}
        clientName={selectedClient?.name ?? null}
        personaLabel={personaLabel || null}
        personaRole={selectedProfile?.role ?? null}
        gender={gender}
        difficultyLabel={difficulties.find((d) => d.key === difficulty)?.label ?? ""}
        difficultyIntensity={DIFFICULTY_INTENSITY[difficulty] ?? 1}
        onLaunch={handleSubmit}
        loading={loading}
        error={error}
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
        style={{ color: "var(--color-gray)" }}
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
          className="font-display"
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
              style={{ color: "var(--color-gray)" }}
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
      className="text-left transition-all duration-base relative"
      style={{
        background: selected ? "rgba(60, 200, 121, 0.08)" : "#FFFFFF",
        border: selected
          ? "2px solid var(--color-green)"
          : "1px solid var(--color-gray-border)",
        borderRadius: "var(--radius-lg)",
        padding: compact ? "16px 20px" : "20px",
        boxShadow: selected
          ? "0 8px 22px rgba(60, 200, 121, 0.18)"
          : "var(--shadow-xs)",
        transform: selected ? "translateY(-1px)" : "translateY(0)",
        cursor: "pointer",
        width: "100%",
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
            color: "var(--color-dark)",
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
            background: "rgba(245, 165, 36, 0.18)",
            color: "#8A5A0E",
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

function RecapCard({
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
      className="rounded-xl p-6 sticky bottom-4 z-10"
      style={{
        background: ready
          ? "var(--color-dark)"
          : "rgba(244, 241, 248, 0.96)",
        color: ready ? "#FFFFFF" : "var(--color-dark)",
        border: ready ? "none" : "1px solid var(--color-gray-border)",
        boxShadow: ready
          ? "0 18px 40px rgba(34, 25, 50, 0.2)"
          : "var(--shadow-md)",
        backdropFilter: "blur(8px)",
        transition: "all var(--duration-base) var(--ease-out)",
      }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div
            className="text-meta uppercase tracking-widest mb-2"
            style={{
              color: ready ? "rgba(255,255,255,0.55)" : "var(--color-gray)",
            }}
          >
            {ready ? "Prêt à démarrer" : "Configuration en cours"}
          </div>
          {ready ? (
            <p className="text-body-l" style={{ lineHeight: "1.4" }}>
              Tu vas appeler{" "}
              <b style={{ color: "var(--color-green)" }}>{personaLabel}</b>
              {personaRole ? ` (${personaRole})` : ""} pour{" "}
              <b>{clientName}</b>, en mode{" "}
              <b style={{ color: "var(--color-green)" }}>
                {difficultyLabel.toLowerCase()}
              </b>
              . Genre : <b>{gender === "homme" ? "homme" : "femme"}</b>.
            </p>
          ) : (
            <p
              className="text-body"
              style={{ color: "var(--color-gray)" }}
            >
              Complète les étapes pour lancer ton appel.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {ready && (
            <DifficultyBarsLarge
              intensity={difficultyIntensity}
              dark={ready}
            />
          )}
          <Button
            type="submit"
            variant={ready ? "primary" : "ghost"}
            size="lg"
            disabled={!ready || loading}
            loading={loading}
            onClick={onLaunch}
          >
            {loading ? "Génération du scénario..." : "Lancer l'appel →"}
          </Button>
        </div>
      </div>
      {error && (
        <div
          className="mt-3 rounded-md px-4 py-3 text-small"
          style={{
            background: "rgba(233, 75, 75, 0.12)",
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

function DifficultyBarsLarge({
  intensity,
  dark,
}: {
  intensity: number;
  dark: boolean;
}) {
  return (
    <div className="hidden md:flex items-end gap-1">
      {[1, 2, 3, 4].map((level) => (
        <span
          key={level}
          className="rounded-sm"
          style={{
            width: "8px",
            height: `${level * 6 + 6}px`,
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
