"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(traduire(signInError.message));
        setLoading(false);
        return;
      }

      router.push(next ?? "/dashboard");
      router.refresh();
    } catch (err) {
      setError(traduire((err as Error).message));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
      <Input
        id="email"
        type="email"
        label="Email professionnel"
        placeholder="prenom.nom@entreprise.com"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        id="password"
        type="password"
        label="Mot de passe"
        placeholder="••••••••"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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

      <Button type="submit" variant="primary" loading={loading} fullWidth>
        Se connecter
      </Button>
    </form>
  );
}

function traduire(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("variable d'environnement") || lower.includes("env")) {
    return "Configuration manquante côté hébergement : les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY ne sont pas définies. Crée un .env.local en local, ou ajoute-les sur Vercel puis redeploie.";
  }
  if (lower.includes("invalid login")) {
    return "Email ou mot de passe incorrect.";
  }
  if (lower.includes("email not confirmed")) {
    return "Email non confirmé. Re-crée le user dans Supabase avec « Auto Confirm User » coché.";
  }
  if (lower.includes("fetch") || lower.includes("network")) {
    return "Impossible de joindre Supabase. Vérifie l'URL Supabase et ta connexion.";
  }
  return msg;
}
