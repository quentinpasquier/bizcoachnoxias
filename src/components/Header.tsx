import Link from "next/link";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";

interface HeaderProps {
  user: { email?: string | null; full_name?: string | null } | null;
}

export function Header({ user }: HeaderProps) {
  return (
    <header
      className="border-b"
      style={{
        background: "var(--color-dark)",
        borderColor: "rgba(255, 255, 255, 0.08)",
      }}
    >
      <div className="container-noxias flex h-16 items-center justify-between">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center">
          <Logo variant="dark" size={28} />
        </Link>

        {user && (
          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-small text-white/70 hover:text-white transition-colors"
            >
              Tableau de bord
            </Link>
            <Link
              href="/clients"
              className="text-small text-white/70 hover:text-white transition-colors"
            >
              Clients
            </Link>
            <Link
              href="/sessions/new"
              className="text-small text-white/70 hover:text-white transition-colors"
            >
              Nouvelle session
            </Link>
            <Link
              href="/history"
              className="text-small text-white/70 hover:text-white transition-colors"
            >
              Historique
            </Link>
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <span className="text-meta text-white/60">
                {user.full_name ?? user.email}
              </span>
              <SignOutButton />
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
