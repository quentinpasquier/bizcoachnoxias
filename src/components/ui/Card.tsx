import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "lavender" | "dark" | "outline" | "tint";
  padded?: boolean;
  hoverable?: boolean;
}

// Composant Card unifié : utilise les classes .ui-card / .ui-card-* qui sont
// stylées en mode glass dark dans globals.css (palette violet uniforme partout).
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
      ? "ui-card-lavender"
      : variant === "dark"
        ? "ui-card-dark"
        : variant === "outline"
          ? "ui-card-outline"
          : variant === "tint"
            ? "ui-card-tint"
            : "ui-card-default";

  return (
    <div
      className={`ui-card ${variantClass} ${
        padded ? "ui-card-padded" : ""
      } ${hoverable ? "ui-card-hover" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
