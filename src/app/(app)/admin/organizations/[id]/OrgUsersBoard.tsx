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
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function generatePassword(): string {
    // 12 caractères alphanum + symboles, sans confusions (0/O, 1/l/I)
    const charset =
      "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!?#%@";
    let out = "";
    const arr = new Uint32Array(12);
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) {
      out += charset[arr[i]! % charset.length];
    }
    return out;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedSummary(null);
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
            password,
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
      setCreatedSummary({ email, password });
      setEmail("");
      setFullName("");
      setRole("commercial");
      setPassword("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCredentials() {
    if (!createdSummary) return;
    const text = `Email : ${createdSummary.email}\nMot de passe : ${createdSummary.password}\nÀ la 1re connexion, tu devras choisir ton mot de passe permanent.`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // navigateur sans Clipboard API → l'utilisateur sélectionne à la main
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
            + Créer un compte
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
          <div className="grid gap-4 md:grid-cols-2 items-end">
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
            <div className="flex flex-col gap-2">
              <label
                className="text-small font-medium"
                style={{ color: "#b495ff" }}
              >
                Mot de passe temporaire
              </label>
              <div className="flex gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="8 caractères minimum"
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-meta px-2"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                  title={showPassword ? "Masquer" : "Afficher"}
                >
                  {showPassword ? "Masquer" : "Voir"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPassword(generatePassword());
                    setShowPassword(true);
                  }}
                  className="text-meta px-2"
                  style={{ color: "var(--color-green)" }}
                  title="Générer un mdp aléatoire"
                >
                  Générer
                </button>
              </div>
            </div>
          </div>
          <p className="text-meta" style={{ color: "rgba(255,255,255,0.5)" }}>
            L&apos;utilisateur sera contraint de choisir son propre mot de passe
            à sa première connexion.
          </p>
          {error && (
            <p className="text-meta" style={{ color: "var(--color-red)" }}>
              {error}
            </p>
          )}
          {createdSummary && (
            <div
              className="p-3 rounded text-meta space-y-2"
              style={{ background: "rgba(60, 200, 121, 0.12)" }}
            >
              <div>
                Compte créé. Communique ces identifiants à
                l&apos;utilisateur&nbsp;:
              </div>
              <div className="font-mono text-body">
                Email : <strong>{createdSummary.email}</strong>
                <br />
                Mot de passe : <strong>{createdSummary.password}</strong>
              </div>
              <div className="flex gap-3 items-center">
                <button
                  type="button"
                  onClick={copyCredentials}
                  className="underline"
                  style={{ color: "var(--color-green)" }}
                >
                  Copier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedSummary(null);
                    setAdding(false);
                  }}
                  className="underline"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={
                submitting || !email || !fullName || password.length < 8
              }
            >
              {submitting ? "Création…" : "Créer le compte"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setError(null);
                setCreatedSummary(null);
                setPassword("");
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
