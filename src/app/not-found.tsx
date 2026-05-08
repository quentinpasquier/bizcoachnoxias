import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--color-dark)" }}
    >
      <header className="container-noxias h-16 flex items-center">
        <Link href="/">
          <Logo variant="dark" size={28} />
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <div
            className="font-display"
            style={{
              fontSize: "8rem",
              lineHeight: "1",
              color: "var(--color-green)",
            }}
          >
            404
          </div>
          <h1 className="text-h2 text-white mt-4">Cette page n'existe pas.</h1>
          <p className="text-body-l text-white/70 mt-3">
            Le lien est cassé, ou la page a été supprimée.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/dashboard" className="btn btn-primary">
              Retour au dashboard
            </Link>
            <Link
              href="/"
              className="btn text-white border border-white/20 hover:bg-white/5"
            >
              Page d'accueil
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
