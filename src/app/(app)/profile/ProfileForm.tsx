"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import type { UserRole } from "@/lib/supabase/types";

interface Props {
  email: string;
  initialFirstName: string;
  initialLastName: string;
  initialAvatarUrl: string | null;
  role: UserRole;
}

export function ProfileForm({
  email,
  initialFirstName,
  initialLastName,
  initialAvatarUrl,
  role,
}: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Erreur");
      }
      setMessage("Profil enregistré.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        avatar_url?: string;
        error?: string;
      };
      if (!res.ok || !data.avatar_url) {
        throw new Error(data.error ?? "Erreur upload");
      }
      setAvatarUrl(data.avatar_url);
      setMessage("Photo mise à jour.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    setError(null);
    setMessage(null);
    setUploading(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur");
      setAvatarUrl(null);
      setMessage("Photo retirée.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <div className="flex items-center gap-6 flex-wrap">
        <Avatar src={avatarUrl} name={fullName || email} size={96} ring />
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
              id="avatar-upload"
            />
            <label
              htmlFor="avatar-upload"
              className="btn btn-ghost cursor-pointer"
              style={{ opacity: uploading ? 0.6 : 1 }}
            >
              {uploading ? "Envoi..." : avatarUrl ? "Changer la photo" : "Ajouter une photo"}
            </label>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={uploading}
                className="btn btn-ghost"
                style={{ color: "var(--color-error)" }}
              >
                Retirer
              </button>
            )}
          </div>
          <p className="text-meta" style={{ color: "var(--color-gray)" }}>
            JPG, PNG ou WEBP, 4 Mo max.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Prénom" required>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Quentin"
            className="input"
            required
          />
        </Field>
        <Field label="Nom">
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Pasquier"
            className="input"
          />
        </Field>
        <Field label="Email">
          <input value={email} disabled className="input" />
        </Field>
        <Field label="Rôle">
          <input
            value={role === "manager" ? "Manager" : "Commercial"}
            disabled
            className="input"
          />
        </Field>
      </div>

      {error && (
        <div
          className="text-small px-3 py-2 rounded-md"
          style={{
            background: "rgba(233, 75, 75, 0.10)",
            color: "#A61F1F",
          }}
        >
          {error}
        </div>
      )}
      {message && (
        <div
          className="text-small px-3 py-2 rounded-md"
          style={{
            background: "rgba(60, 200, 121, 0.12)",
            color: "#1F6A3F",
          }}
        >
          {message}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={saving || !firstName.trim()}
          className="btn btn-dark"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="text-meta uppercase tracking-widest mb-1.5 block"
        style={{ color: "var(--color-gray)" }}
      >
        {label}
        {required && <span style={{ color: "var(--color-error)" }}> *</span>}
      </span>
      {children}
    </label>
  );
}
