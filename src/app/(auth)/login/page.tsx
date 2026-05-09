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
  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-app)" }}
    >
      <header className="container-noxias h-16 flex items-center">
        <Link href="/login">
          <Logo variant="light" size={28} />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="eyebrow-green mb-3">Coach commercial</div>
            <h1
              className="text-h1"
              style={{
                fontSize: "clamp(2.25rem, 4vw, 3rem)",
                lineHeight: "1.1",
              }}
            >
              <span style={{ color: "var(--color-dark)" }}>Salut.</span>{" "}
              <span style={{ color: "var(--color-green)" }}>
                Prêt pour ta session ?
              </span>
            </h1>
            <p
              className="text-body mt-4"
              style={{ color: "var(--color-gray)" }}
            >
              Connecte-toi pour rejoindre ton coach.
            </p>
          </div>

          <LoginForm next={params.next} initialError={params.error} />

          <p
            className="text-meta mt-8 text-center"
            style={{ color: "var(--color-gray)" }}
          >
            Accès réservé aux commerciaux Noxias.
          </p>
        </div>
      </main>
    </div>
  );
}
