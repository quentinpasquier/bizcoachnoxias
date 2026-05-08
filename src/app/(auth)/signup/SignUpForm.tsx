"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

const ALLOWED_DOMAIN = "noxias.com";

export function SignUpForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lower = email.trim().toLowerCase();
    if (!lower.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError(`Seuls les emails @${ALLOWED_DOMAIN} sont autorisés.`);
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: lower,
      password,
      options: {
        data: { full_name: fullName },
        // Pas d'emailRedirectTo : Supabase utilise sa Site URL configurée.
        // Évite les erreurs "Invalid path" quand la liste de redirect URLs
        // n'est pas exhaustive.
      },
    });

    if (signUpError) {
      setError(translateError(signUpError.message));
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="card text-center space-y-3">
        <div className="text-h3" style={{ color: "var(--color-green)" }}>
          Vérifie ta boîte mail.
        </div>
        <p className="text-body" style={{ color: "var(--color-gray)" }}>
          On vient d'envoyer un lien de confirmation à <b>{email}</b>.
          Clique dessus pour activer ton compte.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
      <Input
        id="fullName"
        label="Nom complet"
        placeholder="Camille Martin"
        autoComplete="name"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <Input
        id="email"
        type="email"
        label="Email Noxias"
        placeholder={`prenom.nom@${ALLOWED_DOMAIN}`}
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        id="password"
        type="password"
        label="Mot de passe"
        placeholder="8 caractères minimum"
        autoComplete="new-password"
        required
        minLength={8}
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
        Activer mon compte
      </Button>
    </form>
  );
}

function translateError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("noxias.com") || lower.includes("@noxias")) {
    return "Seuls les emails @noxias.com sont autorisés.";
  }
  if (lower.includes("user already registered")) {
    return "Cet email est déjà inscrit. Utilise plutôt « Se connecter ».";
  }
  if (lower.includes("invalid path") || lower.includes("redirect")) {
    return "Configuration Supabase Auth : ajoute ton domaine Vercel + http://localhost:3000 dans Authentication → URL Configuration → Redirect URLs (avec /** ou /* à la fin), puis Save.";
  }
  if (lower.includes("fetch") || lower.includes("network")) {
    return "Impossible de joindre Supabase. Vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (sans espace, sans slash final).";
  }
  return msg;
}
