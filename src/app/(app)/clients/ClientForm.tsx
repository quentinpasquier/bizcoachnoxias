"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { Client } from "@/lib/supabase/types";

interface Props {
  initial?: Client;
}

export function ClientForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? "");
  const [sector, setSector] = useState(initial?.sector ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [valueProp, setValueProp] = useState(initial?.value_proposition ?? "");
  const [productPitch, setProductPitch] = useState(initial?.product_pitch ?? "");
  const [idealTargets, setIdealTargets] = useState(initial?.ideal_targets ?? "");
  const [objectionsRaw, setObjectionsRaw] = useState(
    initial?.typical_objections?.join("\n") ?? "",
  );
  const [active, setActive] = useState(initial?.active ?? true);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Le nom du client est obligatoire.");
    if (!productPitch.trim())
      return setError("Le pitch à porter est obligatoire.");

    setLoading(true);

    const payload = {
      name: name.trim(),
      sector: sector.trim() || null,
      description: description.trim() || null,
      value_proposition: valueProp.trim() || null,
      product_pitch: productPitch.trim(),
      ideal_targets: idealTargets.trim() || null,
      typical_objections: objectionsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      active,
    };

    const url = isEdit ? `/api/clients/${initial!.id}` : "/api/clients";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'enregistrement.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    router.push(isEdit ? `/clients/${initial!.id}` : `/clients/${data.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!initial) return;
    if (
      !confirm(
        `Supprimer définitivement « ${initial.name} » ? Les sessions passées seront conservées mais le client disparaîtra des listes.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/clients/${initial.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Suppression impossible.");
      setDeleting(false);
      return;
    }
    router.push("/clients");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card className="space-y-5">
        <Input
          id="name"
          label="Nom du client *"
          placeholder="Cabinet Mercier & Associés"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          id="sector"
          label="Secteur"
          placeholder="Conseil RH, SaaS Finance, Agence design..."
          hint="Une étiquette courte pour catégoriser"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        />

        <Textarea
          id="description"
          label="Description"
          rows={2}
          placeholder="Cabinet de conseil RH spécialisé dans la rétention de talents tech."
          hint="1-2 phrases de contexte"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Textarea
          id="valueProp"
          label="Value proposition"
          rows={2}
          placeholder="Diviser par 2 le turnover des profils tech en 6 mois."
          hint="La promesse en une phrase, idéalement avec un chiffre"
          value={valueProp}
          onChange={(e) => setValueProp(e.target.value)}
        />

        <Textarea
          id="productPitch"
          label="Pitch à porter en RDV *"
          rows={3}
          placeholder="Programme d'accompagnement RH sur 6 mois pour diviser par 2 le turnover des profils tech, avec audit, plan d'action et suivi mensuel."
          hint="Ce que le commercial Noxias doit pitcher au prospect — le prospect base son jugement sur ça"
          required
          value={productPitch}
          onChange={(e) => setProductPitch(e.target.value)}
        />

        <Input
          id="idealTargets"
          label="Cibles idéales"
          placeholder="DRH grand compte, DRH ETI tech"
          hint="Séparées par virgules"
          value={idealTargets}
          onChange={(e) => setIdealTargets(e.target.value)}
        />

        <Textarea
          id="objections"
          label="Objections classiques"
          rows={5}
          placeholder={`On a déjà un cabinet RH\nOn gère ça en interne\nPas le moment, on est en pleine NAO\nTrop cher`}
          hint="Une objection par ligne. L'IA prospect pourra les ressortir."
          value={objectionsRaw}
          onChange={(e) => setObjectionsRaw(e.target.value)}
        />

        <div className="flex items-center gap-3 pt-2 border-t border-[rgba(139,127,163,0.16)]">
          <input
            id="active"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-5 h-5 rounded accent-[var(--color-green)]"
          />
          <label htmlFor="active" className="text-small">
            Client actif (visible dans les listes de sélection)
          </label>
        </div>
      </Card>

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

      <div className="flex justify-between flex-wrap gap-3">
        <div>
          {isEdit && (
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
            >
              Supprimer
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {isEdit ? "Enregistrer" : "Créer le client"}
          </Button>
        </div>
      </div>
    </form>
  );
}
