import type { ReactNode } from "react";

type Tone = "success" | "info" | "warning" | "error" | "neutral";

interface Props {
  children: ReactNode;
  tone?: Tone;
}

export function StatusPill({ children, tone = "info" }: Props) {
  return <span className={`status-pill is-${tone}`}>{children}</span>;
}
