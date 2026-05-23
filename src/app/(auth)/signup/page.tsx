import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/Card";

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--color-lavender)" }}
    >
      <header className="container-noxias flex h-16 items-center">
        <Link href="/login">
          <Logo variant="light" size={36} />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <span className="divider-green block mb-4" />
            <h1 className="text-h2">Pas d'inscription publique.</h1>
            <p
              className="text-body-l mt-2"
              style={{ color: "var(--color-gray)" }}
            >
              Accès sur invitation. Les comptes sont créés par l'administrateur
              de ton organisation.
            </p>
          </div>

          <Card className="space-y-3">
            <p className="text-body" style={{ color: "var(--color-dark)" }}>
              Pour obtenir un accès, contacte l'administrateur de ton
              organisation. Il te communiquera tes identifiants après création
              du compte.
            </p>
          </Card>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="btn btn-primary inline-flex"
            >
              Retour à la connexion
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
