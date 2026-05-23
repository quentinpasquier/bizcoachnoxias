"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export function SetPasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="email"
        label="Email"
        value={email}
        disabled
        readOnly
      />
      <Input
        type="password"
        label="Nouveau mot de passe"
        placeholder="••••••••"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint="8 caractères minimum"
      />
      <Input
        type="password"
        label="Confirme le mot de passe"
        placeholder="••••••••"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
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
      <Button type="submit" loading={loading} fullWidth>
        Activer mon compte
      </Button>
    </form>
  );
}
