interface LogoProps {
  variant?: "dark" | "light" | "mono";
  size?: number;
}

export function Logo({ variant = "dark", size = 32 }: LogoProps) {
  const color =
    variant === "light" ? "var(--color-purple)" : "#FFFFFF";

  return (
    <span
      className="select-none"
      style={{
        color,
        fontSize: Math.round(size * 0.7),
        letterSpacing: "0.04em",
        lineHeight: 1,
        fontWeight: 700,
        textTransform: "uppercase",
        display: "inline-block",
      }}
      aria-label="Noxias"
    >
      NOXIAS
    </span>
  );
}
