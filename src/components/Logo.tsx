interface LogoProps {
  variant?: "dark" | "light" | "mono";
  size?: number;
  withWordmark?: boolean;
}

export function Logo({ variant = "dark", size = 32, withWordmark = true }: LogoProps) {
  const wordmarkColor =
    variant === "dark" ? "#FFFFFF" : variant === "light" ? "#34244B" : "#FFFFFF";
  const showAccent = variant !== "mono";

  return (
    <div className="inline-flex items-center gap-3" aria-label="Noxias">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill={wordmarkColor} />
        <path
          d="M9 22V10h2.4l6.2 8.4V10H20v12h-2.4L11.4 13.6V22H9z"
          fill={variant === "dark" ? "#221932" : "#FFFFFF"}
        />
        {showAccent && (
          <rect
            x="22"
            y="20"
            width="5"
            height="5"
            transform="rotate(45 24.5 22.5)"
            fill="#3CC879"
          />
        )}
      </svg>
      {withWordmark && (
        <span
          className="font-display tracking-wide"
          style={{
            color: wordmarkColor,
            fontSize: Math.round(size * 0.75),
            letterSpacing: "0.04em",
          }}
        >
          NOXIAS
        </span>
      )}
    </div>
  );
}
