"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GAMING_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/sessions/new", label: "Nouvelle session", primary: true },
  { href: "/progress", label: "Ma progression" },
  { href: "/history", label: "Historique" },
];

export function HeaderNav({
  isManager,
  isPlatformAdmin,
  isNoxiasOrg = true,
}: {
  isManager?: boolean;
  isPlatformAdmin?: boolean;
  isNoxiasOrg?: boolean;
}) {
  const pathname = usePathname();
  const configItems = [
    { href: "/clients", label: isNoxiasOrg ? "Clients" : "Offres" },
  ];

  function isActive(href: string): boolean {
    return (
      pathname === href ||
      (href !== "/" && pathname?.startsWith(href + "/") === true) ||
      pathname === href
    );
  }

  return (
    <nav className="hidden md:flex items-center gap-3 flex-1 ml-6">
      {/* Section GAMING (violet) : la plus importante */}
      <div className="nav-section nav-section-gaming">
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

      {/* Section CONFIG (blanc) : secondaire */}
      <div className="nav-section nav-section-config">
        {configItems.map((item) => {
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
        {isPlatformAdmin && (
          <Link
            href="/admin/organizations"
            className={`nav-pill nav-pill-config ${
              isActive("/admin") ? "nav-pill-active" : ""
            }`}
            title="Back-office Noxias · gestion des organisations clientes"
          >
            Admin
          </Link>
        )}
      </div>
    </nav>
  );
}
