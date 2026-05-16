"use client";

export type OrbState = "idle" | "speaking" | "listening" | "thinking" | "ended";

interface VoiceOrbProps {
  state: OrbState;
  size?: number;
  intensity?: 1 | 2 | 3 | 4;
}

// Palette par intensité de difficulté.
// La couleur principale = anneau extérieur + glow. L'accent (vert) reste vert
// (le commercial est toujours en vert, c'est la marque).
const PALETTES: Record<
  1 | 2 | 3 | 4,
  {
    primary: string; // ring + core gradient
    primarySoft: string; // halo / inset
    coreLight: string; // highlight haut de la sphère
    coreDark: string; // bas de la sphère
    name: string;
  }
> = {
  1: {
    primary: "#3CC879",
    primarySoft: "rgba(60, 200, 121, 0.40)",
    coreLight: "rgba(150, 230, 180, 0.95)",
    coreDark: "rgba(20, 60, 40, 0.95)",
    name: "Débutant",
  },
  2: {
    primary: "#9d6bff",
    primarySoft: "rgba(157, 107, 255, 0.40)",
    coreLight: "rgba(180, 149, 255, 0.95)",
    coreDark: "rgba(34, 25, 50, 0.95)",
    name: "Intermédiaire",
  },
  3: {
    primary: "#F5A524",
    primarySoft: "rgba(245, 165, 36, 0.40)",
    coreLight: "rgba(255, 200, 110, 0.95)",
    coreDark: "rgba(80, 40, 0, 0.95)",
    name: "Avancé",
  },
  4: {
    primary: "#E94B4B",
    primarySoft: "rgba(233, 75, 75, 0.45)",
    coreLight: "rgba(255, 150, 150, 0.95)",
    coreDark: "rgba(70, 10, 10, 0.95)",
    name: "Expert",
  },
};

// VoiceOrb façon Jarvis : sphère colorée selon le niveau avec anneaux orbitaux,
// barres audio centrales qui bondissent quand l'IA parle, et halo réactif.
export function VoiceOrb({ state, size = 240, intensity = 2 }: VoiceOrbProps) {
  const p = PALETTES[intensity];
  const isActive = state === "speaking" || state === "listening";
  const isSpeaking = state === "speaking";
  const isThinking = state === "thinking";
  const isListening = state === "listening";
  const ended = state === "ended";

  const opacity = ended ? 0.35 : 1;

  // Speed
  const ringSpeed = isSpeaking ? 6 : isActive ? 8 : 14;
  const barSpeed = isSpeaking ? 0.5 : isListening ? 0.7 : 1.2;

  return (
    <div
      className="jarvis-orb"
      style={{
        width: size,
        height: size,
        opacity,
        transition: "opacity 0.4s ease",
      }}
    >
      {/* Halo extérieur pulsant, couleur par niveau */}
      <span
        className="jarvis-halo"
        style={{
          background: `radial-gradient(circle at center, ${p.primarySoft} 0%, rgba(60, 200, 121, 0.10) 35%, transparent 70%)`,
          animationDuration: `${isActive ? 1.4 : 2.6}s`,
        }}
        aria-hidden="true"
      />

      {/* Anneau extérieur en rotation, couleur par niveau */}
      <svg
        className="jarvis-ring jarvis-ring-outer"
        viewBox="0 0 200 200"
        style={{ animationDuration: `${ringSpeed * 2.2}s` }}
        aria-hidden="true"
      >
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke={p.primary}
          strokeOpacity="0.6"
          strokeWidth="1.5"
          strokeDasharray="4 8"
        />
      </svg>

      {/* Anneau du milieu en rotation inverse */}
      <svg
        className="jarvis-ring jarvis-ring-mid"
        viewBox="0 0 200 200"
        style={{ animationDuration: `${ringSpeed * 1.3}s` }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="jarvis-ring-mid-grad" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(60, 200, 121, 0.75)" />
            <stop offset="60%" stopColor="rgba(60, 200, 121, 0.10)" />
            <stop offset="100%" stopColor="rgba(60, 200, 121, 0)" />
          </linearGradient>
        </defs>
        <circle
          cx="100"
          cy="100"
          r="76"
          fill="none"
          stroke="url(#jarvis-ring-mid-grad)"
          strokeWidth="1"
        />
        {/* Petites encoches indicators */}
        <circle cx="100" cy="24" r="2.5" fill="rgba(60, 200, 121, 0.9)" />
        <circle cx="176" cy="100" r="2" fill="rgba(60, 200, 121, 0.7)" />
        <circle cx="100" cy="176" r="2" fill="rgba(60, 200, 121, 0.7)" />
        <circle cx="24" cy="100" r="2" fill="rgba(60, 200, 121, 0.7)" />
      </svg>

      {/* Anneau intérieur quasi statique */}
      <svg
        className="jarvis-ring jarvis-ring-inner"
        viewBox="0 0 200 200"
        aria-hidden="true"
      >
        <circle
          cx="100"
          cy="100"
          r="60"
          fill="none"
          stroke="rgba(255, 255, 255, 0.10)"
          strokeWidth="1"
        />
      </svg>

      {/* Cœur de l'orb : sphère gradient, couleur par niveau */}
      <span
        className="jarvis-core"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${p.coreLight} 0%, ${p.primary} 50%, ${p.coreDark} 100%)`,
          opacity: isActive ? 1 : 0.7,
          boxShadow: isActive
            ? `0 0 50px ${p.primarySoft}, inset 0 0 30px ${p.primarySoft}, inset 0 -12px 30px rgba(20, 9, 31, 0.6)`
            : `0 0 30px ${p.primarySoft}, inset 0 0 22px ${p.primarySoft}, inset 0 -10px 25px rgba(20, 9, 31, 0.6)`,
        }}
        aria-hidden="true"
      />

      {/* Highlight 3D blanc sur le haut */}
      <span className="jarvis-highlight" aria-hidden="true" />

      {/* Barres audio centrales */}
      <div className="jarvis-bars" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="jarvis-bar"
            style={{
              animationDuration: `${barSpeed + i * 0.05}s`,
              animationDelay: `${i * 0.06}s`,
              animationPlayState:
                state === "idle" || ended ? "paused" : "running",
              background: isSpeaking
                ? "linear-gradient(to top, rgba(60, 200, 121, 0.4), #3CC879, rgba(60, 200, 121, 0.4))"
                : isListening
                  ? "linear-gradient(to top, rgba(157, 107, 255, 0.4), #b495ff, rgba(157, 107, 255, 0.4))"
                  : "linear-gradient(to top, rgba(157, 107, 255, 0.25), rgba(157, 107, 255, 0.55), rgba(157, 107, 255, 0.25))",
              boxShadow: isSpeaking
                ? "0 0 8px rgba(60, 200, 121, 0.6)"
                : "0 0 8px rgba(157, 107, 255, 0.4)",
            }}
          />
        ))}
      </div>

      {/* Triangle thinking */}
      {isThinking && (
        <div className="jarvis-thinking" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}
