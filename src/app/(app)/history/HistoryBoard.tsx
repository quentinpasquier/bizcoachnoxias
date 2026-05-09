"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { DifficultyBadge, ScoreBadge } from "@/components/ui/Badge";
import { StatusPill } from "@/components/ui/Status";
import { FilterChip } from "@/components/ui/FilterChip";
import { formatDateTimeFr, formatDuration } from "@/lib/format";
import type { SessionRow } from "@/lib/supabase/types";

interface Props {
  sessions: SessionRow[];
  clientById: Record<string, { name: string; sector: string | null }>;
  profileById: Record<string, { full_name: string; avatar_url: string | null }>;
  myUserId: string | null;
  isManager?: boolean;
}

type FilterKey = "all" | "mine" | "rdv" | "hangup" | "active";

export function HistoryBoard({
  sessions,
  clientById,
  profileById,
  myUserId,
  isManager = false,
}: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(
    () => ({
      all: sessions.length,
      mine: sessions.filter((s) => s.user_id === myUserId).length,
      rdv: sessions.filter((s) => s.appointment_secured).length,
      hangup: sessions.filter(
        (s) => s.ended_by === "prospect" && !s.appointment_secured,
      ).length,
      active: sessions.filter((s) => s.status === "active").length,
    }),
    [sessions, myUserId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (filter === "mine" && s.user_id !== myUserId) return false;
      if (filter === "rdv" && !s.appointment_secured) return false;
      if (
        filter === "hangup" &&
        !(s.ended_by === "prospect" && !s.appointment_secured)
      )
        return false;
      if (filter === "active" && s.status !== "active") return false;

      if (q) {
        const client =
          (s.client_id && clientById[s.client_id]?.name) ?? s.client_name_snapshot ?? "";
        const author = profileById[s.user_id]?.full_name ?? "";
        const haystack = [
          client.toLowerCase(),
          author.toLowerCase(),
          s.persona_label.toLowerCase(),
        ].join(" ");
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, filter, search, clientById, profileById, myUserId]);

  return (
    <>
      <Card padded={false} className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="input-search flex items-center gap-2 flex-1 min-w-[260px]">
            <SearchIcon />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un commercial, un client, un persona..."
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
              Toutes
            </FilterChip>
            {isManager && (
              <FilterChip
                active={filter === "mine"}
                count={counts.mine}
                onClick={() => setFilter("mine")}
              >
                Les miennes
              </FilterChip>
            )}
            <FilterChip
              active={filter === "rdv"}
              count={counts.rdv}
              onClick={() => setFilter("rdv")}
            >
              RDV obtenus
            </FilterChip>
            <FilterChip
              active={filter === "hangup"}
              count={counts.hangup}
              onClick={() => setFilter("hangup")}
            >
              Raccrochés
            </FilterChip>
            <FilterChip
              active={filter === "active"}
              count={counts.active}
              onClick={() => setFilter("active")}
            >
              En cours
            </FilterChip>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card variant="lavender" className="text-center py-12">
          <p style={{ color: "var(--color-gray)" }}>
            Aucune session ne correspond.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const client = s.client_id ? clientById[s.client_id] : null;
            const clientName =
              client?.name ?? s.client_name_snapshot ?? "Client supprimé";
            const authorProfile = profileById[s.user_id];
            const author = authorProfile?.full_name ?? "Anonyme";
            const authorAvatar = authorProfile?.avatar_url ?? null;
            const isMe = s.user_id === myUserId;
            return (
              <Link
                key={s.id}
                href={
                  s.status === "active"
                    ? `/sessions/${s.id}`
                    : `/sessions/${s.id}/feedback`
                }
              >
                <Card hoverable className="mb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      {isManager && (
                        <Avatar src={authorAvatar} name={author} size={40} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span
                            className="text-meta font-bold uppercase tracking-widest"
                            style={{ color: "var(--color-purple)" }}
                          >
                            {clientName}
                          </span>
                          <span
                            className="text-meta"
                            style={{ color: "var(--color-gray)" }}
                          >
                            ·
                          </span>
                          <span className="text-h4">{s.persona_label}</span>
                          <DifficultyBadge difficulty={s.difficulty} />
                          {s.status === "active" && (
                            <StatusPill tone="success">En cours</StatusPill>
                          )}
                          {s.appointment_secured && (
                            <StatusPill tone="success">RDV</StatusPill>
                          )}
                          {s.ended_by === "prospect" && !s.appointment_secured && (
                            <StatusPill tone="error">Raccroché</StatusPill>
                          )}
                          {isMe && (
                            <span
                              className="badge"
                              style={{
                                background: "rgba(60, 200, 121, 0.10)",
                                color: "#1F6A3F",
                              }}
                            >
                              Toi
                            </span>
                          )}
                        </div>
                        <p
                          className="text-small"
                          style={{ color: "var(--color-gray)" }}
                        >
                          <span style={{ color: "var(--color-dark)", fontWeight: 500 }}>
                            {author}
                          </span>
                          {" · "}
                          {formatDateTimeFr(s.started_at)}
                          {" · "}
                          {formatDuration(s.started_at, s.ended_at)}
                        </p>
                      </div>
                    </div>
                    <ScoreBadge score={s.score} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
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
