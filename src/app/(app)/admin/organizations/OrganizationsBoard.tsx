"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { NOXIAS_ORG_ID } from "@/lib/supabase/types";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  users_count: number;
  clients_count: number;
  sessions_count: number;
}

export function OrganizationsBoard({ initialOrgs }: { initialOrgs: OrgRow[] }) {
  const [orgs, setOrgs] = useState<OrgRow[]>(initialOrgs);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erreur de création");
      } else {
        setOrgs((prev) => [
          {
            ...json.organization,
            users_count: 0,
            clients_count: 0,
            sessions_count: 0,
          },
          ...prev,
        ]);
        setName("");
        setSlug("");
        setCreating(false);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {!creating ? (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)} variant="primary">
            + Nouvelle organisation
          </Button>
        </div>
      ) : (
        <Card>
          <form onSubmit={handleCreate} className="space-y-4">
            <h3 className="text-h3">Nouvelle organisation</h3>
            <Input
              label="Nom"
              placeholder="Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <Input
              label="Slug (optionnel)"
              placeholder="acme — auto-généré si vide"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            {error && (
              <p className="text-meta" style={{ color: "var(--color-red)" }}>
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting || !name.trim()}>
                {submitting ? "Création…" : "Créer"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                }}
              >
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-4">
        {orgs.map((o) => {
          const isNoxias = o.id === NOXIAS_ORG_ID;
          return (
            <Link
              key={o.id}
              href={`/admin/organizations/${o.id}`}
              className="block"
            >
              <Card hoverable className="cursor-pointer">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-h3">{o.name}</h3>
                      {isNoxias && <Badge tone="success">Noxias</Badge>}
                      {!o.active && <Badge tone="neutral">Désactivée</Badge>}
                    </div>
                    <p
                      className="text-meta mt-1"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      slug : <code>{o.slug}</code> · créée le{" "}
                      {new Date(o.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex gap-6 text-meta shrink-0">
                    <Stat label="Users" value={o.users_count} />
                    <Stat label="Clients" value={o.clients_count} />
                    <Stat label="Sessions" value={o.sessions_count} />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-h3 leading-none">{value}</div>
      <div
        className="text-[10px] uppercase tracking-widest mt-1"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {label}
      </div>
    </div>
  );
}
