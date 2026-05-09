"use client";

interface CoachAvatarProps {
  state?: "idle" | "thinking" | "speaking" | "happy";
  size?: number;
  withHalo?: boolean;
}

// Petit robot Noxias mignon. Tête arrondie violet sombre, yeux verts qui
// brillent, antenne avec losange vert (signature Noxias), sourire discret.
// Anime selon l'état.
export function CoachAvatar({
  state = "idle",
  size = 64,
  withHalo = false,
}: CoachAvatarProps) {
  const animation =
    state === "thinking"
      ? "robotThink 1.6s ease-in-out infinite"
      : state === "speaking"
        ? "robotSpeak 1.2s ease-in-out infinite"
        : state === "happy"
          ? "robotHappy 0.8s ease-in-out infinite"
          : "robotIdle 4s ease-in-out infinite";

  const eyeAnimation =
    state === "thinking" || state === "speaking"
      ? "robotEyes 2.4s ease-in-out infinite"
      : "robotEyesIdle 6s ease-in-out infinite";

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
            animation: "robotHalo 1.6s ease-in-out infinite",
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
          filter: "drop-shadow(0 4px 12px rgba(34, 25, 50, 0.18))",
        }}
        aria-label="Coach Noxias, ton petit robot"
      >
        <defs>
          <linearGradient id={`robotBody-${size}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3D2A56" />
            <stop offset="100%" stopColor="#221932" />
          </linearGradient>
          <radialGradient id={`robotEye-${size}`} cx="40%" cy="40%">
            <stop offset="0%" stopColor="#A8E5C2" />
            <stop offset="50%" stopColor="#3CC879" />
            <stop offset="100%" stopColor="#1F6A3F" />
          </radialGradient>
        </defs>

        {/* Antenne */}
        <line
          x1="50"
          y1="6"
          x2="50"
          y2="20"
          stroke="#3D2A56"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Losange vert au bout de l'antenne */}
        <rect
          x="44"
          y="2"
          width="12"
          height="12"
          transform="rotate(45 50 8)"
          fill="#3CC879"
          style={{
            transformOrigin: "50px 8px",
            animation: "robotAntenna 2s ease-in-out infinite",
          }}
        />

        {/* Tête (rond carré) */}
        <rect
          x="14"
          y="20"
          width="72"
          height="60"
          rx="22"
          fill={`url(#robotBody-${size})`}
        />

        {/* Reflet blanc en haut */}
        <ellipse
          cx="40"
          cy="32"
          rx="18"
          ry="5"
          fill="rgba(255,255,255,0.15)"
        />

        {/* Yeux : 2 cercles verts brillants */}
        <g style={{ animation: eyeAnimation, transformOrigin: "center" }}>
          <circle
            cx="36"
            cy="48"
            r="9"
            fill={`url(#robotEye-${size})`}
          />
          <circle
            cx="64"
            cy="48"
            r="9"
            fill={`url(#robotEye-${size})`}
          />
          {/* Reflets blancs dans les yeux */}
          <circle cx="33" cy="45" r="2.5" fill="#FFFFFF" />
          <circle cx="61" cy="45" r="2.5" fill="#FFFFFF" />
        </g>

        {/* Bouche (sourire discret) */}
        <path
          d={
            state === "happy"
              ? "M 38 64 Q 50 74 62 64"
              : state === "speaking"
                ? "M 40 65 Q 50 70 60 65"
                : "M 40 66 Q 50 70 60 66"
          }
          stroke="#3CC879"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Petites oreilles/boutons sur les côtés */}
        <circle cx="14" cy="50" r="3" fill="#3CC879" opacity="0.7" />
        <circle cx="86" cy="50" r="3" fill="#3CC879" opacity="0.7" />
      </svg>

      <style>{`
        @keyframes robotIdle {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.015) translateY(-2px); }
        }
        @keyframes robotThink {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.04) rotate(-3deg); }
          75% { transform: scale(1.04) rotate(3deg); }
        }
        @keyframes robotSpeak {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes robotHappy {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.10) rotate(-4deg); }
          75% { transform: scale(1.10) rotate(4deg); }
        }
        @keyframes robotHalo {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.20); opacity: 0.85; }
        }
        @keyframes robotAntenna {
          0%, 100% { transform: rotate(0deg); transform-origin: 50px 14px; }
          50% { transform: rotate(8deg); transform-origin: 50px 14px; }
        }
        @keyframes robotEyes {
          0%, 80%, 100% { transform: scaleY(1); }
          90% { transform: scaleY(0.1); }
        }
        @keyframes robotEyesIdle {
          0%, 92%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.1); }
        }
      `}</style>
    </div>
  );
}
