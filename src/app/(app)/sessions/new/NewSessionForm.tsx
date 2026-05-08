"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import type { Difficulty } from "@/lib/supabase/types";

interface PersonaOption {
  key: string;
  label: string;
  role: string;
  company: string;
}

interface DifficultyOption {
  key: string;
  label: string;
  description: string;
}

interface Props {
  personas: PersonaOption[];
  difficulties: DifficultyOption[];
}

export function NewSessionForm({ personas, difficulties }: Props) {
  const router = useRouter();
  const [personaKey, setPersonaKey] = useState(personas[0].key);
  const [difficulty, setDifficulty] = useState<Difficulty>("debutant");
  const [productPitch, setProductPitch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/sessions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        difficulty,
        personaKey,
        productPitch: productPitch.trim() || null,
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
    <form onSubmit={handleSubmit} className="space-y-7">
      <section>
        <SectionTitle number="01" title="Choisis ton prospect" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {personas.map((p) => (
            <button
              type="button"
              key={p.key}
              onClick={() => setPersonaKey(p.key)}
              className="text-left transition-all duration-base"
            >
              <Card
                className={`hover:shadow-lg ${
                  personaKey === p.key
                    ? "ring-2 ring-[var(--color-green)]"
                    : ""
                }`}
              >
                <div className="text-h4 mb-1">{p.label}</div>
                <div
                  className="text-small"
                  style={{ color: "var(--color-gray)" }}
                >
                  {p.role}
                </div>
                <div
                  className="text-small mt-1"
                  style={{ color: "var(--color-dark)" }}
                >
                  {p.company}
                </div>
              </Card>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle number="02" title="Calibre la difficulté" />
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
                  difficulty === d.key
                    ? "ring-2 ring-[var(--color-green)]"
                    : ""
                }`}
              >
                <div className="text-h4 mb-1">{d.label}</div>
                <div
                  className="text-small"
                  style={{ color: "var(--color-gray)" }}
                >
                  {d.description}
                </div>
              </Card>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle number="03" title="Ton pitch (optionnel)" />
        <Textarea
          id="pitch"
          label=""
          rows={3}
          placeholder="Ex : SaaS de pilotage de la trésorerie pour PME multi-entités."
          hint="Aide le prospect à mieux contextualiser tes objections. Tu peux laisser vide."
          value={productPitch}
          onChange={(e) => setProductPitch(e.target.value)}
        />
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
          onClick={() => router.push("/dashboard")}
          disabled={loading}
        >
          Annuler
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          Lancer l'appel →
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
