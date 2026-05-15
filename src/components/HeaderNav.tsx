"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GAMING_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/sessions/new", label: "Nouvelle session", primary: true },
  { href: "/leaderboard", label: "Classement" },
  { href: "/history", label: "Historique" },
];

const CONFIG_ITEMS = [{ href: "/clients", label: "Clients" }];

export function HeaderNav({ isManager }: { isManager?: boolean }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    return (
      pathname === href ||
      (href !== "/" && pathname?.startsWith(href + "/") === true) ||
      pathname === href
    );
  }

  return (
    <nav className="hidden md:flex items-center gap-2 flex-1 ml-6">
      {/* Section GAMING (violet) — la plus importante */}
      <div className="nav-section nav-section-gaming">
        <span className="nav-section-label" aria-hidden="true">
          Mission
        </span>
        <div className="nav-section-inner">
          {GAMING_ITEMS.map((item) => {
            const active = isActive(item.href);
            const isHistory = item.href === "/history";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-pill nav-pill-gaming ${
                  active ? "nav-pill-active" : ""
                } ${item.primary ? "nav-pill-primary" : ""}`}
              >
                {item.label}
                {isHistory && isManager && (
                  <span className="nav-manager-tag">Tous</span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Section CONFIG (blanc) — secondaire */}
      <div className="nav-section nav-section-config">
        <span className="nav-section-label" aria-hidden="true">
          Config
        </span>
        <div className="nav-section-inner">
          {CONFIG_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-pill nav-pill-config ${
                  active ? "nav-pill-active" : ""
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
