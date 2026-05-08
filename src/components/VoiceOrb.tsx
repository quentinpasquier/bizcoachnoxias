"use client";

import { useEffect, useState } from "react";

export type OrbState = "idle" | "speaking" | "listening" | "thinking" | "ended";

interface VoiceOrbProps {
  state: OrbState;
  size?: number;
  intensity?: 1 | 2 | 3 | 4;
}

// Palette par intensité de difficulté
const PALETTES: Record<1 | 2 | 3 | 4, [string, string, string, string]> = {
  1: ["#A8E5C2", "#3CC879", "#1F6A3F", "#E8F5ED"], // débutant : verts
  2: ["#A8C8F0", "#4A8FE7", "#1F4A88", "#E5EFFA"], // intermédiaire : bleus
  3: ["#F8C97C", "#F5A524", "#8A5A0E", "#FCE9C7"], // avancé : orange
  4: ["#F19999", "#E94B4B", "#A61F1F", "#FBDDDD"], // expert : rouges
};

export function VoiceOrb({ state, size = 220, intensity = 1 }: VoiceOrbProps) {
  const palette = PALETTES[intensity];

  const speed =
    state === "speaking"
      ? "fast"
      : state === "listening"
        ? "fast"
        : state === "thinking"
          ? "medium"
          : "slow";

  const opacity = state === "ended" ? 0.4 : 1;

  return (
    <div
      className="relative inline-block"
      style={{ width: size, height: size, opacity, transition: "opacity 0.4s" }}
    >
      {/* Halo extérieur pulsant */}
      <div
        className="absolute inset-0 rounded-pill"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${palette[1]}40 0%, transparent 70%)`,
          filter: "blur(24px)",
          animation: `orbHalo ${speed === "fast" ? "1.6s" : speed === "medium" ? "3s" : "5s"} ease-in-out infinite`,
        }}
        aria-hidden="true"
      />

      {/* Orbe principal */}
      <div
        className="absolute inset-3 rounded-pill overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${palette[3]} 0%, ${palette[0]} 50%, ${palette[1]} 100%)`,
          boxShadow: `0 12px 40px ${palette[1]}40, inset 0 -8px 24px ${palette[2]}30, inset 0 8px 24px #ffffff80`,
        }}
      >
        {/* Blob lumineux qui bouge */}
        <div
          className="absolute rounded-pill"
          style={{
            width: "70%",
            height: "70%",
            top: "8%",
            left: "12%",
            background: `radial-gradient(circle, ${palette[3]} 0%, ${palette[0]}80 40%, transparent 70%)`,
            filter: "blur(18px)",
            animation: `orbBlob1 ${speed === "fast" ? "2.4s" : speed === "medium" ? "4s" : "7s"} ease-in-out infinite`,
          }}
          aria-hidden="true"
        />

        {/* Blob secondaire */}
        <div
          className="absolute rounded-pill"
          style={{
            width: "55%",
            height: "55%",
            bottom: "10%",
            right: "8%",
            background: `radial-gradient(circle, ${palette[1]} 0%, ${palette[2]}80 50%, transparent 80%)`,
            filter: "blur(20px)",
            animation: `orbBlob2 ${speed === "fast" ? "2s" : speed === "medium" ? "3.4s" : "6s"} ease-in-out infinite`,
          }}
          aria-hidden="true"
        />

        {/* Highlight blanc (effet 3D) */}
        <div
          className="absolute rounded-pill"
          style={{
            width: "45%",
            height: "30%",
            top: "8%",
            left: "20%",
            background:
              "radial-gradient(ellipse, rgba(255,255,255,0.7) 0%, transparent 60%)",
            filter: "blur(14px)",
            animation: state === "speaking" ? "orbShine 2.4s ease-in-out infinite" : "none",
          }}
          aria-hidden="true"
        />
      </div>

      <style>{`
        @keyframes orbHalo {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes orbBlob1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(8%, 6%) scale(1.05); }
          50% { transform: translate(12%, -2%) scale(0.95); }
          75% { transform: translate(-4%, 8%) scale(1.08); }
        }
        @keyframes orbBlob2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-12%, -8%) scale(1.1); }
          66% { transform: translate(6%, 10%) scale(0.9); }
        }
        @keyframes orbShine {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
