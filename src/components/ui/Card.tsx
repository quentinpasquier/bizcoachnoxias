import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "lavender" | "dark" | "outline" | "tint";
  padded?: boolean;
  hoverable?: boolean;
}

export function Card({
  children,
  variant = "default",
  padded = true,
  hoverable = false,
  className = "",
  ...rest
}: CardProps) {
  const variantClass =
    variant === "lavender"
      ? "bg-[var(--color-lavender)] border-[rgba(52,36,75,0.04)]"
      : variant === "dark"
        ? "bg-[var(--color-dark)] text-white border-[rgba(255,255,255,0.06)]"
        : variant === "outline"
          ? "bg-transparent border-[rgba(52,36,75,0.10)]"
          : variant === "tint"
            ? "bg-[var(--bg-soft)] border-[rgba(52,36,75,0.04)]"
            : "bg-white border-[var(--color-gray-border)]";

  return (
    <div
      className={`rounded-lg border ${variantClass} ${
        padded ? "p-6" : ""
      } ${hoverable ? "card-hover" : ""} ${className}`}
      style={{ boxShadow: "var(--shadow-xs)" }}
      {...rest}
    >
      {children}
    </div>
  );
}
