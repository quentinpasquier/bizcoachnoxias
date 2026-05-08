import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SignUpForm } from "./SignUpForm";

export default function SignUpPage() {
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

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <span className="divider-green block mb-4" />
            <h1 className="text-h2">Crée ton compte.</h1>
            <p
              className="text-body-l mt-2"
              style={{ color: "var(--color-gray)" }}
            >
              5 minutes pour démarrer ta première session.
            </p>
          </div>

          <SignUpForm />

          <p
            className="text-small mt-6 text-center"
            style={{ color: "var(--color-gray)" }}
          >
            Déjà un compte ?{" "}
            <Link
              href="/login"
              className="font-medium hover:underline"
              style={{ color: "var(--color-purple)" }}
            >
              Se connecter
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
