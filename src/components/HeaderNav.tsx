"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/clients", label: "Clients" },
  { href: "/sessions/new", label: "Nouvelle session" },
  { href: "/history", label: "Historique" },
];

export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex items-center gap-7 flex-1 ml-8">
      {ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${active ? "active" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
