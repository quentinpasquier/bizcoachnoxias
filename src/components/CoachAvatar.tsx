"use client";

interface CoachAvatarProps {
  state?: "idle" | "thinking" | "speaking" | "happy";
  size?: number;
  withHalo?: boolean;
}

// Avatar du coach virtuel Noxias.
// Cercle violet sombre + losange vert signature + lettre N en wordmark.
// Anime subtilement selon l'état pour donner une présence "vivante".
export function CoachAvatar({
  state = "idle",
  size = 64,
  withHalo = false,
}: CoachAvatarProps) {
  const animation =
    state === "thinking"
      ? "coachThink 1.6s ease-in-out infinite"
      : state === "speaking"
        ? "coachSpeak 1.2s ease-in-out infinite"
        : state === "happy"
          ? "coachHappy 0.8s ease-in-out infinite"
          : "coachIdle 4s ease-in-out infinite";

  return (
    <div
      className="relative inline-block"
      style={{ width: size, height: size }}
    >
      {withHalo && (state === "thinking" || state === "speaking") && (
        <span
          className="absolute inset-0 rounded-pill"
          style={{
            background:
              "radial-gradient(circle, rgba(60,200,121,0.30) 0%, transparent 70%)",
            animation: "coachHalo 1.6s ease-in-out infinite",
          }}
          aria-hidden="true"
        />
      )}

      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{
          animation,
          display: "block",
          position: "relative",
          filter: "drop-shadow(0 4px 12px rgba(34, 25, 50, 0.20))",
        }}
        aria-label="Coach Noxias"
      >
        <defs>
          <radialGradient id={`coachGlow-${size}`} cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#3CC879" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3CC879" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id={`coachBg-${size}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#3D2A56" />
            <stop offset="100%" stopColor="#221932" />
          </linearGradient>
        </defs>

        {/* Cercle de fond */}
        <circle cx="50" cy="50" r="48" fill={`url(#coachBg-${size})`} />

        {/* Glow vert intérieur */}
        <circle cx="50" cy="38" r="34" fill={`url(#coachGlow-${size})`} />

        {/* Highlight blanc (effet 3D) */}
        <ellipse
          cx="38"
          cy="28"
          rx="14"
          ry="6"
          fill="rgba(255,255,255,0.18)"
        />

        {/* N letter */}
        <text
          x="50"
          y="65"
          textAnchor="middle"
          fontFamily="Anton, Arial Black, Helvetica, sans-serif"
          fontSize="50"
          fontWeight="900"
          fill="#FFFFFF"
          letterSpacing="-2"
        >
          N
        </text>

        {/* Losange vert signature */}
        <rect
          x="66"
          y="66"
          width="14"
          height="14"
          transform="rotate(45 73 73)"
          fill="#3CC879"
        />
      </svg>

      <style>{`
        @keyframes coachIdle {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.015) translateY(-1px); }
        }
        @keyframes coachThink {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.04) rotate(-2deg); }
          75% { transform: scale(1.04) rotate(2deg); }
        }
        @keyframes coachSpeak {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes coachHappy {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.08) rotate(-3deg); }
          75% { transform: scale(1.08) rotate(3deg); }
        }
        @keyframes coachHalo {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.20); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
