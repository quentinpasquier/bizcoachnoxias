import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "lavender" | "dark";
  padded?: boolean;
}

export function Card({
  children,
  variant = "default",
  padded = true,
  className = "",
  ...rest
}: CardProps) {
  const variantClass =
    variant === "lavender"
      ? "bg-[var(--color-lavender)] border-[rgba(52,36,75,0.08)]"
      : variant === "dark"
        ? "bg-[var(--color-dark)] text-white border-[rgba(255,255,255,0.08)]"
        : "bg-white border-[rgba(139,127,163,0.16)]";

  return (
    <div
      className={`rounded-lg border shadow-md ${variantClass} ${
        padded ? "p-6" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
