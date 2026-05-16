"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Status";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { FilterChip } from "@/components/ui/FilterChip";
import type { ClientWithStats } from "./page";

type FilterKey = "all" | "active" | "ready" | "without-docs" | "inactive";

export function ClientsBoard({ clients }: { clients: ClientWithStats[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(
    () => ({
      all: clients.length,
      active: clients.filter((c) => c.active).length,
      ready: clients.filter((c) => c.has_docs && c.persona_count > 0).length,
      "without-docs": clients.filter((c) => !c.has_docs).length,
      inactive: clients.filter((c) => !c.active).length,
    }),
    [clients],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !(c.sector?.toLowerCase().includes(q))) {
        return false;
      }
      if (filter === "active") return c.active;
      if (filter === "ready") return c.has_docs && c.persona_count > 0;
      if (filter === "without-docs") return !c.has_docs;
      if (filter === "inactive") return !c.active;
      return true;
    });
  }, [clients, filter, search]);

  return (
    <>
      {/* Search + filtres */}
      <Card padded={false} className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="input-search flex items-center gap-2 flex-1 min-w-[260px]">
            <SearchIcon />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client ou un secteur..."
              className="bg-transparent outline-none flex-1 text-body"
              style={{ color: "var(--color-dark)" }}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChip
              active={filter === "all"}
              count={counts.all}
              onClick={() => setFilter("all")}
            >
              Tous
            </FilterChip>
            <FilterChip
              active={filter === "active"}
              count={counts.active}
              onClick={() => setFilter("active")}
            >
              Actifs
            </FilterChip>
            <FilterChip
              active={filter === "ready"}
              count={counts.ready}
              onClick={() => setFilter("ready")}
            >
              Prêts à appeler
            </FilterChip>
            <FilterChip
              active={filter === "without-docs"}
              count={counts["without-docs"]}
              onClick={() => setFilter("without-docs")}
            >
              Sans docs
            </FilterChip>
            <FilterChip
              active={filter === "inactive"}
              count={counts.inactive}
              onClick={() => setFilter("inactive")}
            >
              Inactifs
            </FilterChip>
          </div>
        </div>
      </Card>

      {/* Grille de clients */}
      {filtered.length === 0 ? (
        <Card variant="lavender" className="text-center py-12">
          <p style={{ color: "var(--color-gray)" }}>
            Aucun client ne correspond.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <ClientCard key={c.id} client={c} />
          ))}
        </div>
      )}
    </>
  );
}

function ClientCard({ client }: { client: ClientWithStats }) {
  const status = !client.active
    ? { tone: "neutral" as const, label: "Inactif" }
    : !client.has_docs
      ? { tone: "warning" as const, label: "Docs manquants" }
      : client.persona_count === 0
        ? { tone: "warning" as const, label: "Personas à extraire" }
        : { tone: "success" as const, label: "Prêt à appeler" };

  const completion = client.persona_count;
  const completionMax = Math.max(client.persona_count, 1);

  return (
    <Link href={`/clients/${client.id}`}>
      <Card hoverable className="h-full flex flex-col">
        {/* Header : nom + statut */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h3 className="text-h4" style={{ color: "#FFFFFF" }}>
              {client.name}
            </h3>
            {client.sector && (
              <p
                className="text-meta uppercase tracking-widest mt-1"
                style={{ color: "var(--color-green)", fontWeight: 700 }}
              >
                {client.sector}
              </p>
            )}
          </div>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        </div>

        {/* Value prop ou pitch */}
        {(client.value_proposition || client.product_pitch) && (
          <p
            className="text-small mt-2 mb-4 line-clamp-2"
            style={{ color: "rgba(255, 255, 255, 0.78)" }}
          >
            {client.value_proposition ?? client.product_pitch}
          </p>
        )}

        {/* Personas count + barre */}
        <div className="mt-auto pt-4 space-y-3">
          <div className="flex items-center justify-between text-small">
            <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>
              Personas extraits
            </span>
            <span style={{ color: "#FFFFFF", fontWeight: 600 }}>
              {client.persona_count}
            </span>
          </div>
          <ProgressBar
            value={completion}
            max={completionMax}
            tone={completion > 0 ? "green" : "auto"}
          />

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <StatTile label="Sessions" value={client.total_sessions.toString()} />
            <StatTile
              label="Score moyen"
              value={
                client.avg_score !== null ? `${client.avg_score}/100` : "·"
              }
            />
            <StatTile label="RDV obtenus" value={client.rdv_secured.toString()} />
            <StatTile
              label="Terminées"
              value={client.completed_sessions.toString()}
            />
          </div>
        </div>
      </Card>
    </Link>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <div
        className="text-meta uppercase tracking-widest"
        style={{
          color: "rgba(255, 255, 255, 0.55)",
          fontSize: "0.6875rem",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        className="text-body font-semibold mt-1"
        style={{ color: "#FFFFFF" }}
      >
        {value}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--color-gray)" }}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
