"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { UserRole } from "@/lib/supabase/types";

export interface AdminUserRow {
  id: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
}

type AssignableRole = Extract<
  UserRole,
  "commercial" | "manager" | "org_admin"
>;
const ROLE_OPTIONS: { value: AssignableRole; label: string }[] = [
  { value: "commercial", label: "Commercial" },
  { value: "manager", label: "Manager" },
  { value: "org_admin", label: "Admin de l'org" },
];

interface Props {
  orgId: string;
  orgName: string;
  initialUsers: AdminUserRow[];
  allowAddUser?: boolean;
}

export function OrgUsersBoard({
  orgId,
  orgName,
  initialUsers,
  allowAddUser,
}: Props) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AssignableRole>("commercial");
  const [sendInvite, setSendInvite] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTempPassword(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/organizations/${orgId}/users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            full_name: fullName,
            role,
            send_invite: sendInvite,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erreur");
        return;
      }
      setUsers((prev) => [
        {
          id: json.user.id,
          full_name: fullName,
          role,
          avatar_url: null,
          email: json.user.email,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      if (json.temp_password) setTempPassword(json.temp_password);
      setEmail("");
      setFullName("");
      setRole("commercial");
      if (!json.temp_password) setAdding(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: AssignableRole) {
    const prev = users;
    setUsers((u) =>
      u.map((x) => (x.id === userId ? { ...x, role: newRole } : x)),
    );
    const res = await fetch(
      `/api/admin/organizations/${orgId}/users/${userId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      },
    );
    if (!res.ok) {
      setUsers(prev);
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? "Mise à jour échouée");
    }
  }

  async function handleDelete(userId: string) {
    if (
      !confirm(
        "Supprimer définitivement cet utilisateur ? Toutes ses sessions et son profil seront perdus.",
      )
    )
      return;
    const prev = users;
    setUsers((u) => u.filter((x) => x.id !== userId));
    const res = await fetch(
      `/api/admin/organizations/${orgId}/users/${userId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      setUsers(prev);
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? "Suppression échouée");
    }
  }

  return (
    <div className="space-y-4">
      {allowAddUser && !adding && (
        <div className="flex justify-end">
          <Button onClick={() => setAdding(true)} variant="primary">
            + Inviter un utilisateur
          </Button>
        </div>
      )}

      {adding && (
        <form
          onSubmit={handleAdd}
          className="space-y-4 p-4 rounded-lg"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <h4 className="text-h4">Nouvel utilisateur dans {orgName}</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="jean.dupont@acme.com"
            />
            <Input
              label="Nom complet"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Jean Dupont"
            />
          </div>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex flex-col gap-2">
              <label
                className="text-small font-medium"
                style={{ color: "#b495ff" }}
              >
                Rôle
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AssignableRole)}
                className="input"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-body cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={sendInvite}
                onChange={(e) => setSendInvite(e.target.checked)}
              />
              Envoyer un email d&apos;invitation
            </label>
          </div>
          {error && (
            <p className="text-meta" style={{ color: "var(--color-red)" }}>
              {error}
            </p>
          )}
          {tempPassword && (
            <div
              className="p-3 rounded text-meta"
              style={{ background: "rgba(244, 180, 0, 0.15)" }}
            >
              Compte créé sans email. Mot de passe temporaire :{" "}
              <code>{tempPassword}</code>
              <br />
              Communique-le manuellement à l&apos;utilisateur. Il pourra le
              changer après connexion.
            </div>
          )}
          <div className="flex gap-3">
            <Button type="submit" disabled={submitting || !email || !fullName}>
              {submitting
                ? "Envoi…"
                : sendInvite
                  ? "Envoyer l'invitation"
                  : "Créer le compte"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setError(null);
                setTempPassword(null);
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      )}

      {users.length === 0 ? (
        <p
          className="text-body"
          style={{ color: "rgba(255, 255, 255, 0.55)" }}
        >
          Aucun utilisateur dans cette organisation pour l&apos;instant.
        </p>
      ) : (
        <ul className="divide-y divide-white/10">
          {users.map((u) => (
            <li
              key={u.id}
              className="py-3 flex items-center gap-4 flex-wrap"
            >
              <Avatar
                src={u.avatar_url}
                name={u.full_name ?? u.email}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <div className="text-body">
                  {u.full_name ?? "(sans nom)"}
                </div>
                <div
                  className="text-meta"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {u.email ?? u.id}
                </div>
              </div>
              {u.role === "platform_admin" ? (
                <Badge tone="warning">Platform admin</Badge>
              ) : (
                <select
                  value={u.role}
                  onChange={(e) =>
                    handleRoleChange(u.id, e.target.value as AssignableRole)
                  }
                  className="input text-small"
                  style={{ width: "auto", padding: "0.4rem 0.6rem" }}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              )}
              {u.role !== "platform_admin" && (
                <button
                  onClick={() => handleDelete(u.id)}
                  className="text-meta hover:underline"
                  style={{ color: "var(--color-red, #E94B4B)" }}
                  title="Supprimer l'utilisateur"
                >
                  Supprimer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
