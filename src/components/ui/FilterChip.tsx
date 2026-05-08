"use client";

import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}

export function FilterChip({ children, active = false, count, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`filter-chip ${active ? "active" : ""}`}
    >
      <span>{children}</span>
      {typeof count === "number" && (
        <span className="filter-chip-count">{count}</span>
      )}
    </button>
  );
}
