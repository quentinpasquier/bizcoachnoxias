"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

interface Org {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

export function OrgSettings({
  org,
  canDelete,
}: {
  org: Org;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [active, setActive] = useState(org.active);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = name.trim() !== org.name || active !== org.active;

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    setError(null);
    const res = await fetch(`/api/admin/organizations/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), active }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Échec de la mise à jour");
      return;
    }
    setMsg("Modifications enregistrées.");
    router.refresh();
  }

  async function handleDelete() {
    if (
      !confirm(
        `Supprimer définitivement l'organisation "${org.name}" ? Possible uniquement si elle ne contient plus aucun user/client/session.`,
      )
    )
      return;
    setDeleting(true);
    const res = await fetch(`/api/admin/organizations/${org.id}`, {
      method: "DELETE",
    });
    const json = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      alert(json.error ?? "Suppression impossible");
      return;
    }
    router.push("/admin/organizations");
  }

  return (
    <Card>
      <h3 className="text-h3 mb-4">Paramètres</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <label
            className="text-small font-medium"
            style={{ color: "#b495ff" }}
          >
            Statut
          </label>
          <label className="flex items-center gap-2 text-body cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Organisation active (sinon ses users ne peuvent plus se connecter
            via la base&nbsp;: cf. logique applicative)
          </label>
        </div>
      </div>
      {msg && (
        <p className="text-meta mt-3" style={{ color: "var(--color-green)" }}>
          {msg}
        </p>
      )}
      {error && (
        <p className="text-meta mt-3" style={{ color: "var(--color-red)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-3 mt-4 flex-wrap">
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {canDelete && (
          <Button
            onClick={handleDelete}
            variant="danger"
            disabled={deleting}
          >
            {deleting ? "Suppression…" : "Supprimer l'organisation"}
          </Button>
        )}
      </div>
      <p
        className="text-meta mt-3"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        Le slug <code>{org.slug}</code> n&apos;est pas modifiable.
      </p>
    </Card>
  );
}
