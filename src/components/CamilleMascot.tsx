"use client";

type MascotState = "idle" | "happy" | "speaking" | "thinking";

interface CamilleMascotProps {
  state?: MascotState;
  size?: number;
  withHalo?: boolean;
}

// Camille, la mascotte commerciale Noxias.
// Visage sympa, casque téléphonique, badge vert. Sert d'avatar humain
// dans l'app (login, dashboard, briefing) pour humaniser l'expérience.
// SVG vectoriel, animations CSS légères.
export function CamilleMascot({
  state = "idle",
  size = 96,
  withHalo = false,
}: CamilleMascotProps) {
  const animation =
    state === "thinking"
      ? "camilleThink 2.4s ease-in-out infinite"
      : state === "speaking"
        ? "camilleSpeak 1.4s ease-in-out infinite"
        : state === "happy"
          ? "camilleHappy 1.2s ease-in-out infinite"
          : "camilleIdle 5s ease-in-out infinite";

  return (
    <div
      className="relative inline-block"
      style={{ width: size, height: size }}
    >
      {withHalo && (
        <span
          className="absolute inset-[-12%] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(60, 200, 121, 0.22) 0%, transparent 70%)",
            zIndex: 0,
          }}
          aria-hidden="true"
        />
      )}

      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        style={{
          animation,
          display: "block",
          position: "relative",
          zIndex: 1,
          filter: "drop-shadow(0 6px 16px rgba(34, 25, 50, 0.32))",
        }}
        aria-label="Camille, coach commerciale Noxias"
      >
        <defs>
          <linearGradient id="camille-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d2860" />
            <stop offset="100%" stopColor="#221932" />
          </linearGradient>
          <linearGradient id="camille-skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDE0C7" />
            <stop offset="100%" stopColor="#F2BF99" />
          </linearGradient>
          <linearGradient id="camille-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2244" />
            <stop offset="100%" stopColor="#1d1126" />
          </linearGradient>
          <linearGradient id="camille-blazer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34244B" />
            <stop offset="100%" stopColor="#1c1230" />
          </linearGradient>
          <radialGradient id="camille-cheek" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF9DA5" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FF9DA5" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Cercle de fond avec dégradé */}
        <circle cx="60" cy="60" r="58" fill="url(#camille-bg)" />
        <circle
          cx="60"
          cy="60"
          r="56"
          fill="none"
          stroke="rgba(60, 200, 121, 0.45)"
          strokeWidth="1.5"
        />

        {/* Épaules / blazer */}
        <path
          d="M 22 110 Q 30 86 60 86 Q 90 86 98 110 Z"
          fill="url(#camille-blazer)"
        />
        {/* Col blanc */}
        <path
          d="M 50 88 L 60 94 L 70 88 L 67 100 L 60 102 L 53 100 Z"
          fill="#FAFAFA"
          opacity="0.92"
        />
        {/* Badge vert sur le blazer */}
        <rect
          x="35"
          y="100"
          width="14"
          height="6"
          rx="1.5"
          fill="var(--color-green, #3CC879)"
        />
        <rect
          x="38"
          y="102.5"
          width="8"
          height="1"
          fill="rgba(255,255,255,0.85)"
        />

        {/* Cou */}
        <path
          d="M 53 78 L 53 88 Q 60 90 67 88 L 67 78 Z"
          fill="url(#camille-skin)"
        />
        <path
          d="M 53 84 Q 60 88 67 84"
          fill="rgba(0,0,0,0.10)"
          stroke="none"
        />

        {/* Cheveux derrière */}
        <path
          d="M 28 56 Q 28 36 60 30 Q 92 36 92 56 L 92 76 Q 92 80 88 80 L 32 80 Q 28 80 28 76 Z"
          fill="url(#camille-hair)"
        />

        {/* Visage */}
        <ellipse
          cx="60"
          cy="60"
          rx="22"
          ry="25"
          fill="url(#camille-skin)"
        />

        {/* Cheveux frange */}
        <path
          d="M 38 48 Q 44 38 60 36 Q 76 38 82 48 Q 78 44 70 44 Q 60 44 50 48 Q 44 48 38 48 Z"
          fill="url(#camille-hair)"
        />
        <path
          d="M 38 58 Q 36 70 38 80 L 42 80 Q 40 70 42 60 Z"
          fill="url(#camille-hair)"
        />
        <path
          d="M 82 58 Q 84 70 82 80 L 78 80 Q 80 70 78 60 Z"
          fill="url(#camille-hair)"
        />

        {/* Joues */}
        <circle cx="48" cy="66" r="5" fill="url(#camille-cheek)" />
        <circle cx="72" cy="66" r="5" fill="url(#camille-cheek)" />

        {/* Yeux verts */}
        <g
          style={{
            animation:
              state === "thinking"
                ? "camilleEyesThink 3s ease-in-out infinite"
                : "camilleBlink 5.5s ease-in-out infinite",
            transformOrigin: "center",
          }}
        >
          <ellipse cx="51" cy="60" rx="2.8" ry="3.4" fill="#1a1226" />
          <ellipse cx="69" cy="60" rx="2.8" ry="3.4" fill="#1a1226" />
          {/* Reflets dans les yeux */}
          <circle cx="52" cy="58.5" r="0.9" fill="#FFFFFF" />
          <circle cx="70" cy="58.5" r="0.9" fill="#FFFFFF" />
          {/* Iris vert subtil */}
          <circle cx="51" cy="60.5" r="1.3" fill="rgba(60, 200, 121, 0.25)" />
          <circle cx="69" cy="60.5" r="1.3" fill="rgba(60, 200, 121, 0.25)" />
        </g>

        {/* Sourcils */}
        <path
          d="M 47 52 Q 51 49 55 52"
          stroke="#2a1733"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 65 52 Q 69 49 73 52"
          stroke="#2a1733"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />

        {/* Nez */}
        <path
          d="M 59 64 Q 58 68 60 70 Q 62 68 61 64"
          stroke="rgba(0,0,0,0.10)"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Bouche */}
        <g
          style={{
            transformOrigin: "60px 75px",
            animation:
              state === "speaking"
                ? "camilleMouthSpeak 0.5s ease-in-out infinite"
                : "none",
          }}
        >
          {state === "happy" || state === "speaking" ? (
            <path
              d="M 53 73 Q 60 80 67 73"
              stroke="#A61F3F"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M 54 74 Q 60 78 66 74"
              stroke="#A61F3F"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          )}
          {/* Lèvre inférieure */}
          <path
            d="M 56 76 Q 60 77 64 76"
            stroke="rgba(166, 31, 63, 0.4)"
            strokeWidth="1"
            fill="none"
          />
        </g>

        {/* Casque téléphonique - arceau */}
        <path
          d="M 38 46 Q 60 24 82 46"
          stroke="#221932"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        {/* Casque - écouteur gauche */}
        <ellipse cx="36" cy="56" rx="5.5" ry="7" fill="#221932" />
        <ellipse
          cx="36"
          cy="56"
          rx="3"
          ry="4.5"
          fill="rgba(60, 200, 121, 0.8)"
        />
        {/* Casque - écouteur droit */}
        <ellipse cx="84" cy="56" rx="5.5" ry="7" fill="#221932" />
        <ellipse
          cx="84"
          cy="56"
          rx="3"
          ry="4.5"
          fill="rgba(60, 200, 121, 0.8)"
        />
        {/* Mic */}
        <path
          d="M 36 62 Q 32 70 36 78 L 44 76"
          stroke="#221932"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse
          cx="44.5"
          cy="76"
          rx="2.5"
          ry="1.5"
          fill="var(--color-green, #3CC879)"
        />

        {/* Petite étincelle verte (effet idle) */}
        {state === "happy" && (
          <g style={{ animation: "camilleSparkle 1.2s ease-out infinite" }}>
            <circle cx="98" cy="34" r="1.8" fill="var(--color-green, #3CC879)" />
            <circle cx="22" cy="40" r="1.4" fill="var(--color-green, #3CC879)" opacity="0.7" />
          </g>
        )}
      </svg>
    </div>
  );
}
