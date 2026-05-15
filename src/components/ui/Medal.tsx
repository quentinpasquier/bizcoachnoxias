import type { BadgeRarity } from "@/lib/badges";

const RARITY_CONFIG: Record<
  BadgeRarity,
  { primary: string; secondary: string; ring: string; glow: string; label: string }
> = {
  commun: {
    primary: "#8B7FA3",
    secondary: "#5C5470",
    ring: "rgba(139, 127, 163, 0.40)",
    glow: "rgba(139, 127, 163, 0.18)",
    label: "Commun",
  },
  rare: {
    primary: "#4A8FE7",
    secondary: "#1F4A88",
    ring: "rgba(74, 143, 231, 0.55)",
    glow: "rgba(74, 143, 231, 0.28)",
    label: "Rare",
  },
  epique: {
    primary: "#9d6bff",
    secondary: "#5b2bb6",
    ring: "rgba(157, 107, 255, 0.6)",
    glow: "rgba(157, 107, 255, 0.32)",
    label: "Épique",
  },
  legendaire: {
    primary: "#F7C041",
    secondary: "#A66A06",
    ring: "rgba(247, 192, 65, 0.65)",
    glow: "rgba(247, 192, 65, 0.40)",
    label: "Légendaire",
  },
};

interface MedalProps {
  icon: string; // une seule lettre/glyph affiché au centre
  rarity: BadgeRarity;
  size?: number;
  locked?: boolean;
  shine?: boolean; // animation brillance pour rare+
}

export function Medal({
  icon,
  rarity,
  size = 72,
  locked = false,
  shine = true,
}: MedalProps) {
  const cfg = RARITY_CONFIG[rarity];
  const opacity = locked ? 0.32 : 1;
  const grayscale = locked ? "grayscale(0.85)" : "none";

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        opacity,
        filter: grayscale,
      }}
      aria-label={`Médaille ${cfg.label}`}
    >
      {/* halo de fond */}
      {!locked && (
        <span
          className="absolute inset-[-12%] rounded-full"
          style={{
            background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)`,
            zIndex: 0,
          }}
          aria-hidden="true"
        />
      )}

      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="relative z-10"
        style={{ display: "block" }}
      >
        <defs>
          <radialGradient
            id={`medal-fill-${rarity}`}
            cx="50%"
            cy="38%"
            r="65%"
          >
            <stop offset="0%" stopColor={cfg.primary} stopOpacity={1} />
            <stop offset="100%" stopColor={cfg.secondary} stopOpacity={1} />
          </radialGradient>
          <linearGradient
            id={`medal-shine-${rarity}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="45%" stopColor="#ffffff" stopOpacity={0.7} />
            <stop offset="55%" stopColor="#ffffff" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* contour externe (anneau) */}
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke={cfg.ring}
          strokeWidth="2"
        />
        {/* médaille principale */}
        <circle cx="50" cy="50" r="40" fill={`url(#medal-fill-${rarity})`} />
        {/* étoile interne pour les rares+, légère */}
        {(rarity === "epique" || rarity === "legendaire") && (
          <polygon
            points="50,18 56,40 78,40 60,53 67,75 50,62 33,75 40,53 22,40 44,40"
            fill="rgba(255,255,255,0.10)"
          />
        )}
        {/* highlight blanc en haut */}
        <ellipse
          cx="50"
          cy="34"
          rx="22"
          ry="9"
          fill="rgba(255, 255, 255, 0.28)"
        />
        {/* shine animé (rare+, non locked) */}
        {!locked && shine && rarity !== "commun" && (
          <g
            style={{
              animation: "medalShine 3.2s linear infinite",
              transformOrigin: "50px 50px",
            }}
          >
            <rect
              x="-30"
              y="40"
              width="60"
              height="20"
              fill={`url(#medal-shine-${rarity})`}
              opacity="0.6"
              transform="rotate(-45 50 50)"
            />
          </g>
        )}
        {/* icone centrale (emoji ou lettre) */}
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fontSize="34"
          style={{
            fontFamily:
              "var(--font-ubuntu), Lato, Apple Color Emoji, Segoe UI Emoji, sans-serif",
          }}
        >
          {icon}
        </text>
        {/* clip externe : 2 rubans en bas */}
        <path
          d="M 35 86 L 30 100 L 42 94 L 50 100 L 58 94 L 70 100 L 65 86 Z"
          fill={cfg.secondary}
          opacity="0.55"
        />
      </svg>

      {locked && (
        <span
          className="absolute right-[-2px] bottom-[-2px] flex items-center justify-center rounded-full"
          style={{
            width: size * 0.32,
            height: size * 0.32,
            background: "var(--color-dark)",
            border: "2px solid var(--bg-app)",
            color: "#FFFFFF",
            fontSize: size * 0.18,
            zIndex: 11,
          }}
          aria-hidden="true"
        >
          <LockIcon size={size * 0.18} />
        </span>
      )}
    </div>
  );
}

function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function rarityLabel(r: BadgeRarity): string {
  return RARITY_CONFIG[r].label;
}

export function rarityColors(r: BadgeRarity) {
  return RARITY_CONFIG[r];
}
