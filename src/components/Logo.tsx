interface LogoProps {
  variant?: "dark" | "light" | "mono";
  size?: number;
}

export function Logo({ variant = "dark", size = 32 }: LogoProps) {
  const color =
    variant === "light" ? "var(--color-purple)" : "#FFFFFF";

  return (
    <span
      className="font-display select-none"
      style={{
        color,
        fontSize: Math.round(size * 0.85),
        letterSpacing: "0.06em",
        lineHeight: 1,
        fontWeight: 400,
        textTransform: "uppercase",
        display: "inline-block",
      }}
      aria-label="Noxias"
    >
      NOXIAS
    </span>
  );
}
