interface LogoProps {
  variant?: "dark" | "light" | "mono";
  size?: number;
}

// Wordmark "Call-Lab" (casse mixte avec tiret) + tagline "powered by Noxias".
// variant=dark  -> blanc (header app, login, 404)
// variant=light -> violet/dark (signup et fonds clairs)
export function Logo({ variant = "dark", size = 32 }: LogoProps) {
  const mainColor =
    variant === "light" ? "var(--color-purple)" : "#FFFFFF";
  const taglineColor =
    variant === "light" ? "rgba(52, 36, 75, 0.55)" : "rgba(255, 255, 255, 0.55)";
  const accentColor = "var(--color-green)";

  const mainFontSize = Math.round(size * 0.62);
  const taglineFontSize = Math.max(9, Math.round(size * 0.22));

  return (
    <span
      className="select-none inline-flex flex-col leading-none"
      style={{ gap: Math.max(2, Math.round(size * 0.06)) }}
      aria-label="Call-Lab, powered by Noxias"
    >
      <span
        style={{
          color: mainColor,
          fontSize: mainFontSize,
          letterSpacing: "-0.01em",
          fontWeight: 800,
          lineHeight: 1,
          fontFamily: "var(--font-ubuntu), Lato, system-ui, sans-serif",
        }}
      >
        Call-Lab
      </span>
      <span
        style={{
          color: taglineColor,
          fontSize: taglineFontSize,
          letterSpacing: "0.18em",
          fontWeight: 600,
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        powered by <span style={{ color: accentColor }}>Noxias</span>
      </span>
    </span>
  );
}
