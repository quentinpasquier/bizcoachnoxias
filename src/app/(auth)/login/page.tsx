import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  // Mode démo : pas d'auth, on va direct au dashboard.
  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  return (
    <div
      className="min-h-screen grid grid-cols-1 lg:grid-cols-2"
      style={{ background: "var(--color-lavender)" }}
    >
      {/* Colonne gauche : login */}
      <div className="flex flex-col">
        <header className="container-noxias h-16 flex items-center">
          <Link href="/login">
            <Logo variant="light" size={28} />
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 pb-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <span className="divider-green block mb-4" />
              <h1 className="text-h2">Bon retour.</h1>
              <p
                className="text-body-l mt-2"
                style={{ color: "var(--color-gray)" }}
              >
                Outil interne Noxias · accès commerciaux.
              </p>
            </div>

            <LoginForm next={params.next} initialError={params.error} />

            <p
              className="text-meta mt-6 text-center"
              style={{ color: "var(--color-gray)" }}
            >
              Accès réservé aux commerciaux Noxias. Compte oublié ou bloqué :
              contacte l'administrateur.
            </p>
          </div>
        </main>
      </div>

      {/* Colonne droite : pitch interne */}
      <div
        className="hidden lg:flex flex-col justify-center px-12"
        style={{ background: "var(--color-dark)" }}
      >
        <div className="max-w-lg">
          <span
            className="text-meta uppercase tracking-widest"
            style={{ color: "var(--color-green)" }}
          >
            Noxias Coach
          </span>
          <h2
            className="font-display mt-3 text-white"
            style={{
              fontSize: "clamp(2.5rem, 4vw, 4.5rem)",
              lineHeight: "1.05",
            }}
          >
            ENTRAÎNE-TOI AVANT
            <br />
            <span style={{ color: "var(--color-green)" }}>D&apos;APPELER LE VRAI.</span>
          </h2>
          <p className="text-body-l text-white/80 mt-6">
            Choisis un client, choisis un prospect, lance l&apos;appel. L&apos;IA
            joue le rôle du dirigeant — objections réalistes, raccrochage
            possible — et tu reçois une restitution chiffrée à la fin.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 pt-8 border-t border-white/10">
            <Stat number="4" label="Niveaux" />
            <Stat number="6" label="Personas" />
            <Stat number="5" label="Axes notés" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div
        className="font-display text-white"
        style={{ fontSize: "2rem", lineHeight: "1" }}
      >
        {number}
      </div>
      <div className="text-meta text-white/60 mt-1">{label}</div>
    </div>
  );
}
