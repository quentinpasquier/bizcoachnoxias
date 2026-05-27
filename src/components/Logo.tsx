interface LogoProps {
  variant?: "dark" | "light" | "mono";
  size?: number;
}

// Icône Erlenmeyer (fiole conique de laboratoire) en SVG inline, style line-art
// stroke 2px, inspirée Lucide FlaskConical. Symbole du "Lab" de Call-Lab.
// Rend via currentColor → on lui pousse la couleur via le style parent.
function FlaskIcon({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: size, height: size, flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </svg>
  );
}

// Wordmark "Call-Lab" (casse mixte avec tiret) + fiole verte + tagline
// "powered by Noxias". Layout : flex-row [fiole | colonne(wordmark / tagline)]
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
  const flaskSize = Math.round(size * 1.05);
  const flaskGap = Math.round(size * 0.3);

  return (
    <span
      className="select-none inline-flex flex-row items-center leading-none"
      style={{ gap: flaskGap }}
      aria-label="Call-Lab, powered by Noxias"
    >
      <span style={{ color: accentColor, display: "inline-flex" }}>
        <FlaskIcon size={flaskSize} />
      </span>
      <span
        className="inline-flex flex-col leading-none"
        style={{ gap: Math.max(2, Math.round(size * 0.06)) }}
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
    </span>
  );
}
