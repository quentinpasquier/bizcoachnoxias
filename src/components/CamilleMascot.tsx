"use client";

type MascotState = "idle" | "happy" | "speaking" | "thinking";

interface CoachMascotProps {
  state?: MascotState;
  size?: number;
  withHalo?: boolean;
}

// Quentin, le coach commercial signé Noxias. Stylé en avatar : coupe courte,
// casque téléphonique, badge vert sur le blazer. Sert d'avatar humain dans
// l'app (login, dashboard, briefing) pour humaniser le coaching.
// SVG vectoriel, animations CSS légères. Le composant est exporté sous deux
// noms (CoachMascot et CamilleMascot) pour compat ascendante des imports.
export function CoachMascot({
  state = "idle",
  size = 96,
  withHalo = false,
}: CoachMascotProps) {
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
        aria-label="Quentin Pasquier, ton coach commercial"
      >
        <defs>
          <linearGradient id="coach-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d2860" />
            <stop offset="100%" stopColor="#221932" />
          </linearGradient>
          <linearGradient id="coach-skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F2C9A1" />
            <stop offset="100%" stopColor="#D9A06F" />
          </linearGradient>
          <linearGradient id="coach-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2244" />
            <stop offset="100%" stopColor="#1d1126" />
          </linearGradient>
          <linearGradient id="coach-blazer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34244B" />
            <stop offset="100%" stopColor="#1c1230" />
          </linearGradient>
        </defs>

        {/* Cercle de fond avec dégradé */}
        <circle cx="60" cy="60" r="58" fill="url(#coach-bg)" />
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
          fill="url(#coach-blazer)"
        />
        {/* Chemise blanche (col en V ouvert, sans cravate, à la dirigeant moderne) */}
        <path
          d="M 50 88 L 60 96 L 70 88 L 65 102 L 60 104 L 55 102 Z"
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
          fill="url(#coach-skin)"
        />
        <path
          d="M 53 84 Q 60 88 67 84"
          fill="rgba(0,0,0,0.10)"
          stroke="none"
        />

        {/* Visage */}
        <ellipse
          cx="60"
          cy="60"
          rx="22"
          ry="25"
          fill="url(#coach-skin)"
        />

        {/* Cheveux courts : coupe nette, dégradés sur les côtés.
            Forme : couvre le haut du crâne et descend légèrement sur les
            tempes, sans couvrir les oreilles. */}
        <path
          d="M 38 50
             Q 38 32 60 28
             Q 82 32 82 50
             Q 78 44 74 43
             Q 66 41 60 42
             Q 54 41 46 43
             Q 42 44 38 50 Z"
          fill="url(#coach-hair)"
        />
        {/* Petite mèche sur le front (asymétrie naturelle) */}
        <path
          d="M 56 38 Q 62 36 66 42 Q 60 42 56 44 Z"
          fill="url(#coach-hair)"
          opacity="0.9"
        />

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

        {/* Sourcils plus marqués (visage masculin) */}
        <path
          d="M 46 51 Q 51 49 56 52"
          stroke="#2a1733"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 64 52 Q 69 49 74 51"
          stroke="#2a1733"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Nez */}
        <path
          d="M 59 64 Q 58 68 60 70 Q 62 68 61 64"
          stroke="rgba(0,0,0,0.12)"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
        />

        {/* Légère barbe naissante (ombre sur la mâchoire) */}
        <path
          d="M 44 74 Q 50 84 60 84 Q 70 84 76 74"
          fill="rgba(58, 34, 68, 0.10)"
          stroke="none"
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
              d="M 53 73 Q 60 79 67 73"
              stroke="#7a3340"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M 54 74 Q 60 77 66 74"
              stroke="#7a3340"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          )}
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

        {/* Petite étincelle verte (effet happy) */}
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

// Alias de compat : les anciens imports `CamilleMascot` continuent de
// fonctionner pendant la transition. À supprimer une fois tous les imports
// migrés.
export const CamilleMascot = CoachMascot;
