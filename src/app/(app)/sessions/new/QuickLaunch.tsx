"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Difficulty, Gender, PersonaProfile } from "@/lib/supabase/types";

interface QuickLaunchClient {
  id: string;
  name: string;
  sector: string | null;
  has_docs: boolean;
  target_personas: string[];
  persona_profiles: PersonaProfile[];
}

interface LastConfig {
  clientId: string;
  clientName: string;
  personaLabel: string;
  difficulty: Difficulty;
  gender: Gender;
}

interface Props {
  clients: QuickLaunchClient[];
  lastConfig: LastConfig | null;
}

const RANDOM_DIFFICULTIES: Difficulty[] = [
  "intermediaire",
  "intermediaire",
  "avance",
  "debutant",
];

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)] ?? null;
}

export function QuickLaunch({ clients, lastConfig }: Props) {
  const router = useRouter();
  const [launching, setLaunching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usableClients = clients.filter(
    (c) => c.has_docs && (c.target_personas.length > 0 || c.persona_profiles.length > 0),
  );

  async function launch(args: {
    clientId: string;
    personaLabel: string;
    difficulty: Difficulty;
    gender: Gender;
    label: string;
  }) {
    setError(null);
    setLaunching(args.label);
    try {
      const res = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: args.clientId,
          difficulty: args.difficulty,
          gender: args.gender,
          personaLabel: args.personaLabel,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Impossible de lancer la mission.");
      }
      const { sessionId } = await res.json();
      router.push(`/sessions/${sessionId}/briefing`);
    } catch (e) {
      setError((e as Error).message);
      setLaunching(null);
    }
  }

  function handleRandom() {
    const c = pickRandom(usableClients);
    if (!c) return setError("Aucun client n'a de docs.");
    const personas =
      c.target_personas.length > 0
        ? c.target_personas
        : c.persona_profiles.map((p) => p.label);
    const persona = pickRandom(personas);
    if (!persona) return;
    const difficulty =
      pickRandom(RANDOM_DIFFICULTIES) ?? ("intermediaire" as Difficulty);
    const gender: Gender = Math.random() > 0.5 ? "homme" : "femme";
    launch({
      clientId: c.id,
      personaLabel: persona,
      difficulty,
      gender,
      label: "random",
    });
  }

  function handleLast() {
    if (!lastConfig) return;
    launch({
      clientId: lastConfig.clientId,
      personaLabel: lastConfig.personaLabel,
      difficulty: lastConfig.difficulty,
      gender: lastConfig.gender,
      label: "last",
    });
  }

  function handleBoss() {
    const c = pickRandom(usableClients);
    if (!c) return setError("Aucun client n'a de docs.");
    const personas =
      c.target_personas.length > 0
        ? c.target_personas
        : c.persona_profiles.map((p) => p.label);
    const persona = pickRandom(personas);
    if (!persona) return;
    const gender: Gender = Math.random() > 0.5 ? "homme" : "femme";
    launch({
      clientId: c.id,
      personaLabel: persona,
      difficulty: "expert",
      gender,
      label: "boss",
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <span className="mission-eyebrow">Quick Launch</span>
          <h2 className="mission-h1" style={{ fontSize: "1.6rem" }}>
            Tu n&apos;as pas le temps de configurer ?
          </h2>
        </div>
        <span
          className="text-small"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Briefing généré en 5-10 secondes.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickCard
          eyebrow="Surprise"
          icon={<DiceIcon />}
          title="Lance random"
          subtitle="Client + persona + niveau tirés au sort."
          accent="#3CC879"
          loading={launching === "random"}
          disabled={launching !== null || usableClients.length === 0}
          onClick={handleRandom}
        />
        <QuickCard
          eyebrow="Reprends"
          icon={<RewindIcon />}
          title={lastConfig ? "Ta dernière config" : "Pas de session récente"}
          subtitle={
            lastConfig
              ? `${lastConfig.clientName} · ${lastConfig.personaLabel} · ${
                  lastConfig.difficulty === "expert"
                    ? "Expert"
                    : lastConfig.difficulty === "avance"
                      ? "Avancé"
                      : lastConfig.difficulty === "intermediaire"
                        ? "Intermédiaire"
                        : "Débutant"
                }`
              : "Lance d'abord une session, je la garde en mémoire."
          }
          accent="#9d6bff"
          loading={launching === "last"}
          disabled={launching !== null || !lastConfig}
          onClick={handleLast}
        />
        <QuickCard
          eyebrow="Mode boss"
          icon={<SkullIcon />}
          title="Affronte un Expert"
          subtitle="Hostile, raccroche vite, accorde rarement un RDV."
          accent="#E94B4B"
          loading={launching === "boss"}
          disabled={launching !== null || usableClients.length === 0}
          onClick={handleBoss}
        />
      </div>

      {error && (
        <div
          className="mission-card text-small"
          style={{
            color: "#FFB4B4",
            background: "rgba(233, 75, 75, 0.08)",
            border: "1px solid rgba(233, 75, 75, 0.32)",
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}

function QuickCard({
  eyebrow,
  icon,
  title,
  subtitle,
  accent,
  loading,
  disabled,
  onClick,
}: {
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mission-card mission-card-hover text-left"
      style={{
        opacity: disabled && !loading ? 0.45 : 1,
        cursor: disabled ? "default" : "pointer",
        borderColor: loading ? accent : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className="mission-eyebrow"
          style={{ color: accent }}
        >
          {eyebrow}
        </span>
        <span
          className="rounded-full flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            background: `${accent}1f`,
            color: accent,
          }}
        >
          {icon}
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--font-ubuntu), Lato, sans-serif",
          fontSize: "1.2rem",
          fontWeight: 700,
          lineHeight: "1.15",
          color: "#FFFFFF",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </p>
      <p
        className="text-small mt-2"
        style={{ color: "rgba(255,255,255,0.6)", lineHeight: "1.45" }}
      >
        {subtitle}
      </p>
      <div className="flex items-center justify-end mt-4">
        <span
          className="text-small"
          style={{
            color: loading ? accent : "rgba(255,255,255,0.7)",
            fontWeight: 600,
          }}
        >
          {loading ? "Briefing..." : "Lance →"}
        </span>
      </div>
    </button>
  );
}

function DiceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="16" cy="16" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

function RewindIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 19 2 12 11 5 11 19" />
      <polygon points="22 19 13 12 22 5 22 19" />
    </svg>
  );
}

function SkullIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 14v.5" />
      <path d="M16 14v.5" />
      <path d="M11.25 16.25h1.5L12 17.5l-.75-1.25z" fill="currentColor" />
      <path d="M4.5 12.5A8 8 0 0 1 12 4a8 8 0 0 1 7.5 8.5c0 1.7-.5 3.3-1.4 4.6L17 19v3h-2v-2H9v2H7v-3l-1.1-1.9A8.6 8.6 0 0 1 4.5 12.5z" />
    </svg>
  );
}
