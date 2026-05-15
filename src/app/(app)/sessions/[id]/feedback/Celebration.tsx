"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Medal } from "@/components/ui/Medal";
import type { Badge as BadgeType } from "@/lib/badges";

interface CelebrationProps {
  score: number;
  appointmentSecured: boolean;
  xpEarned: number;
  newBadges: BadgeType[];
}

const CONFETTI_COLORS = [
  "#3CC879",
  "#9d6bff",
  "#F7C041",
  "#4A8FE7",
  "#E94B4B",
  "#FFFFFF",
];

export function Celebration({
  score,
  appointmentSecured,
  xpEarned,
  newBadges,
}: CelebrationProps) {
  const [hidden, setHidden] = useState(false);
  const [shown, setShown] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [toastsVisible, setToastsVisible] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Mount animation
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Score count-up
  useEffect(() => {
    if (!shown) return;
    let frame = 0;
    const target = score;
    const duration = 1400;
    const start = performance.now();
    let raf: number;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    frame = raf;
    return () => cancelAnimationFrame(frame);
  }, [shown, score]);

  // Badges toasts en cascade
  useEffect(() => {
    if (!shown || newBadges.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    newBadges.forEach((b, i) => {
      timers.push(
        setTimeout(
          () => setToastsVisible((tv) => [...tv, b.id]),
          1200 + i * 600,
        ),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [shown, newBadges]);

  const confettiPieces = useMemo(() => {
    if (!appointmentSecured && score < 70) return [];
    return Array.from({ length: 36 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      delay: Math.random() * 1.2,
      duration: 3 + Math.random() * 2,
      size: 8 + Math.random() * 8,
    }));
  }, [appointmentSecured, score]);

  if (hidden) return null;

  const headline = appointmentSecured
    ? "RDV décroché !"
    : score >= 80
      ? "Belle perf."
      : score >= 60
        ? "C'est encourageant."
        : "Debrief direct.";

  const accentColor = appointmentSecured
    ? "var(--color-green)"
    : score >= 80
      ? "var(--color-green)"
      : score >= 60
        ? "#9d6bff"
        : "#F5A524";

  return (
    <div
      className={`celebration-overlay ${shown ? "celebration-overlay-in" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Résultats de la session"
    >
      <audio ref={audioRef} />

      {/* Confetti */}
      {confettiPieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.size,
            height: p.size * 1.4,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}

      <div className="celebration-content">
        {appointmentSecured && (
          <div className="celebration-rdv-pill">
            <DotPulse />
            RDV OBTENU
          </div>
        )}
        <p className="celebration-headline" style={{ color: accentColor }}>
          {headline}
        </p>

        <div className="celebration-score">
          <span className="celebration-score-value score-pop" style={{ color: accentColor }}>
            {displayScore}
          </span>
          <span className="celebration-score-suffix">/100</span>
        </div>

        <div className="celebration-xp">
          <span className="celebration-xp-label">XP gagnée</span>
          <span className="celebration-xp-value">+{xpEarned} XP</span>
        </div>

        {newBadges.length > 0 && (
          <p className="celebration-badge-hint">
            {newBadges.length} badge{newBadges.length > 1 ? "s" : ""} débloqué
            {newBadges.length > 1 ? "s" : ""}.
          </p>
        )}

        <button
          type="button"
          onClick={() => setHidden(true)}
          className="celebration-cta"
        >
          Voir le débrief détaillé →
        </button>
      </div>

      {/* Badge unlock toasts */}
      <div
        className="celebration-toasts"
        style={{ pointerEvents: "none" }}
        aria-hidden="true"
      >
        {newBadges
          .filter((b) => toastsVisible.includes(b.id))
          .slice(0, 4)
          .map((b, i) => (
            <div
              key={b.id}
              className="badge-toast"
              style={{ bottom: 24 + i * 86 }}
            >
              <Medal icon={b.icon} rarity={b.rarity} size={56} />
              <div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    letterSpacing: "0.18em",
                    color: "var(--color-green)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Badge débloqué
                </div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#FFFFFF",
                    marginTop: 2,
                  }}
                >
                  {b.label}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.6)",
                    marginTop: 2,
                  }}
                >
                  +{b.xpReward} XP bonus
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function DotPulse() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "var(--color-green)",
        boxShadow: "0 0 0 0 rgba(60, 200, 121, 0.5)",
        animation: "login-dot-pulse 1.6s ease-out infinite",
      }}
      aria-hidden="true"
    />
  );
}
