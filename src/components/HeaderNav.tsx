"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/clients", label: "Clients" },
  { href: "/sessions/new", label: "Nouvelle session" },
  { href: "/history", label: "Historique" },
  { href: "/leaderboard", label: "Classement" },
];

export function HeaderNav({ isManager }: { isManager?: boolean }) {
  const pathname = usePathname();
  const items = BASE_ITEMS;
  return (
    <nav className="hidden md:flex items-center gap-7 flex-1 ml-8">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/" && pathname?.startsWith(item.href));
        const isHistory = item.href === "/history";
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${active ? "active" : ""}`}
          >
            {item.label}
            {isHistory && isManager && (
              <span
                className="ml-1.5 text-[9px] uppercase tracking-widest px-1 py-0.5 rounded align-middle"
                style={{
                  background: "var(--color-green)",
                  color: "var(--color-dark)",
                  fontWeight: 700,
                }}
              >
                Tous
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
