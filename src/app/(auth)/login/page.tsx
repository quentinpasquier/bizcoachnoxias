import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--color-lavender)" }}
    >
      <header className="container-noxias flex h-16 items-center">
        <Link href="/">
          <Logo variant="light" size={28} />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <span className="divider-green block mb-4" />
            <h1 className="text-h2">Bon retour.</h1>
            <p
              className="text-body-l mt-2"
              style={{ color: "var(--color-gray)" }}
            >
              Connecte-toi pour reprendre l'entraînement.
            </p>
          </div>

          <LoginForm next={params.next} initialError={params.error} />

          <p
            className="text-small mt-6 text-center"
            style={{ color: "var(--color-gray)" }}
          >
            Pas encore de compte ?{" "}
            <Link
              href="/signup"
              className="font-medium hover:underline"
              style={{ color: "var(--color-purple)" }}
            >
              S'inscrire
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
