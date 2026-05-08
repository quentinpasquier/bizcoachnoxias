"use client";

import { useState } from "react";
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

  // Persona : on prend depuis target_personas (label) en priorité
  const personaOptions =
    selectedClient?.target_personas ?? selectedClient?.persona_profiles.map((p) => p.label) ?? [];
  const [personaLabel, setPersonaLabel] = useState(
    preselectedPersonaLabel ||
      personaOptions[0] ||
      "",
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
    const opts = c?.target_personas ?? c?.persona_profiles.map((p) => p.label) ?? [];
    setPersonaLabel(opts[0] ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) return setError("Choisis un client.");
    if (!personaLabel.trim()) {
      return setError(
        "Aucun persona disponible. Uploade des docs sur ce client.",
      );
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

  // Si client + persona préselectionnés → mode "preset", on ne montre que niveau + genre
  const isPreset = Boolean(preselectedClientId && preselectedPersonaLabel);

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* Si preset : affichage compact du persona */}
      {isPreset && selectedClient && selectedProfile ? (
        <Card variant="lavender">
          <div
            className="text-meta uppercase tracking-widest mb-1"
            style={{ color: "var(--color-gray)" }}
          >
            Tu vas appeler pour {selectedClient.name}
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-h3">{selectedProfile.label}</span>
            <span className="text-body" style={{ color: "var(--color-gray)" }}>
              {selectedProfile.role}
            </span>
          </div>
          {selectedProfile.prep_briefing && (
            <p
              className="text-small mt-3 whitespace-pre-line"
              style={{ color: "var(--color-dark)" }}
            >
              {selectedProfile.prep_briefing}
            </p>
          )}
        </Card>
      ) : (
        <>
          {/* Sélection client */}
          <section>
            <SectionTitle number="01" title="Pour quel client ?" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clients.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => handleClientChange(c.id)}
                  className="text-left transition-all duration-base"
                >
                  <Card
                    className={`hover:shadow-lg h-full ${
                      clientId === c.id ? "ring-2 ring-[var(--color-green)]" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="text-h4">{c.name}</div>
                      {!c.has_docs && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(245, 165, 36, 0.18)",
                            color: "#8A5A0E",
                          }}
                        >
                          Pas de docs
                        </span>
                      )}
                    </div>
                    {c.sector && (
                      <div
                        className="text-meta uppercase tracking-widest mb-2"
                        style={{ color: "var(--color-gray)" }}
                      >
                        {c.sector}
                      </div>
                    )}
                    {c.value_proposition && (
                      <div
                        className="text-small"
                        style={{ color: "var(--color-dark)" }}
                      >
                        {c.value_proposition}
                      </div>
                    )}
                  </Card>
                </button>
              ))}
            </div>
          </section>

          {/* Sélection persona */}
          {selectedClient && personaOptions.length > 0 && (
            <section>
              <SectionTitle number="02" title="Quel persona ?" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {personaOptions.map((p) => {
                  const profile = selectedClient.persona_profiles.find(
                    (pp) => pp.label === p,
                  );
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setPersonaLabel(p)}
                      className="text-left transition-all duration-base"
                    >
                      <Card
                        className={`hover:shadow-lg ${
                          personaLabel === p
                            ? "ring-2 ring-[var(--color-green)]"
                            : ""
                        }`}
                      >
                        <div className="text-h4">{p}</div>
                        {profile?.role && (
                          <div
                            className="text-small mt-1"
                            style={{ color: "var(--color-gray)" }}
                          >
                            {profile.role}
                          </div>
                        )}
                      </Card>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* Genre */}
      <section>
        <SectionTitle
          number={isPreset ? "01" : "03"}
          title="Genre du prospect"
        />
        <div className="grid grid-cols-2 gap-3">
          {(["homme", "femme"] as Gender[]).map((g) => (
            <button
              type="button"
              key={g}
              onClick={() => setGender(g)}
              className="text-left transition-all duration-base"
            >
              <Card
                className={`hover:shadow-lg ${
                  gender === g ? "ring-2 ring-[var(--color-green)]" : ""
                }`}
              >
                <div className="text-h4 capitalize">{g}</div>
              </Card>
            </button>
          ))}
        </div>
      </section>

      {/* Niveau */}
      <section>
        <SectionTitle
          number={isPreset ? "02" : "04"}
          title="Quel niveau ?"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {difficulties.map((d) => (
            <button
              type="button"
              key={d.key}
              onClick={() => setDifficulty(d.key as Difficulty)}
              className="text-left transition-all duration-base"
            >
              <Card
                className={`hover:shadow-lg ${
                  difficulty === d.key ? "ring-2 ring-[var(--color-green)]" : ""
                }`}
              >
                <div className="text-h4 mb-1">{d.label}</div>
                <div className="text-small" style={{ color: "var(--color-gray)" }}>
                  {d.description}
                </div>
              </Card>
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div
          className="rounded-md px-4 py-3 text-small"
          style={{
            background: "rgba(233, 75, 75, 0.08)",
            color: "var(--color-error)",
            border: "1px solid rgba(233, 75, 75, 0.24)",
          }}
        >
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(isPreset ? `/clients/${clientId}` : "/dashboard")}
          disabled={loading}
        >
          Annuler
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {loading ? "Génération du scénario..." : "Lancer l'appel →"}
        </Button>
      </div>
    </form>
  );
}

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
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
      <h2 className="text-h3">{title}</h2>
    </div>
  );
}
