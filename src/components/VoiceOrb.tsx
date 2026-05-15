"use client";

export type OrbState = "idle" | "speaking" | "listening" | "thinking" | "ended";

interface VoiceOrbProps {
  state: OrbState;
  size?: number;
  intensity?: 1 | 2 | 3 | 4;
}

// VoiceOrb façon Jarvis : sphère violette/verte avec anneaux orbitaux,
// barres audio centrales qui bondissent quand l'IA parle, et halo réactif.
// Adapte ses animations à l'état (idle / speaking / listening / thinking).
export function VoiceOrb({ state, size = 240 }: VoiceOrbProps) {
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
      {/* Halo extérieur pulsant */}
      <span
        className="jarvis-halo"
        style={{
          animationDuration: `${isActive ? 1.4 : 2.6}s`,
        }}
        aria-hidden="true"
      />

      {/* Anneau extérieur en rotation */}
      <svg
        className="jarvis-ring jarvis-ring-outer"
        viewBox="0 0 200 200"
        style={{ animationDuration: `${ringSpeed * 2.2}s` }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="jarvis-ring-outer-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(157, 107, 255, 0.85)" />
            <stop offset="40%" stopColor="rgba(157, 107, 255, 0.15)" />
            <stop offset="100%" stopColor="rgba(157, 107, 255, 0)" />
          </linearGradient>
        </defs>
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="url(#jarvis-ring-outer-grad)"
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

      {/* Cœur de l'orb : sphère gradient */}
      <span
        className="jarvis-core"
        style={{
          background: isActive
            ? "radial-gradient(circle at 35% 35%, rgba(180, 149, 255, 0.95) 0%, rgba(107, 63, 182, 0.85) 50%, rgba(34, 25, 50, 0.95) 100%)"
            : "radial-gradient(circle at 35% 35%, rgba(150, 124, 220, 0.6) 0%, rgba(90, 60, 150, 0.5) 50%, rgba(34, 25, 50, 0.85) 100%)",
          boxShadow: isActive
            ? "0 0 50px rgba(157, 107, 255, 0.6), inset 0 0 30px rgba(180, 149, 255, 0.35), inset 0 -12px 30px rgba(20, 9, 31, 0.6)"
            : "0 0 35px rgba(157, 107, 255, 0.3), inset 0 0 25px rgba(157, 107, 255, 0.15), inset 0 -10px 25px rgba(20, 9, 31, 0.6)",
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
