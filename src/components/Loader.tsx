"use client";

interface LoaderProps {
  message?: string;
  detail?: string;
  variant?: "default" | "dark";
  size?: "sm" | "md" | "lg";
}

export function Loader({
  message,
  detail,
  variant = "default",
  size = "md",
}: LoaderProps) {
  const isDark = variant === "dark";
  const widthMap = { sm: "200px", md: "280px", lg: "360px" };
  const heightMap = { sm: 4, md: 6, lg: 8 };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div
        style={{ width: widthMap[size], maxWidth: "90%" }}
        className="relative"
      >
        <div
          className="rounded-pill overflow-hidden"
          style={{
            height: `${heightMap[size]}px`,
            background: isDark
              ? "rgba(255,255,255,0.10)"
              : "rgba(139,127,163,0.14)",
          }}
        >
          <div
            className="h-full rounded-pill"
            style={{
              width: "40%",
              background: `linear-gradient(90deg, transparent 0%, var(--color-green) 40%, var(--color-green) 60%, transparent 100%)`,
              animation: "loaderSlide 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite",
              boxShadow: "0 0 12px rgba(60, 200, 121, 0.6)",
            }}
          />
        </div>
      </div>

      {message && (
        <div className="text-center">
          <p
            className="text-body font-semibold"
            style={{
              color: isDark ? "#FFFFFF" : "var(--color-dark)",
            }}
          >
            {message}
          </p>
          {detail && (
            <p
              className="text-small mt-1"
              style={{
                color: isDark ? "rgba(255,255,255,0.55)" : "var(--color-gray)",
              }}
            >
              {detail}
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes loaderSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}

// Mini version : juste les 3 points qui rebondissent, pour les inline
export function MiniLoader({
  label,
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "dark";
}) {
  const isDark = variant === "dark";
  return (
    <div className="inline-flex items-center gap-2.5">
      <span className="flex items-center gap-1">
        <span
          className="rounded-pill"
          style={{
            width: "6px",
            height: "6px",
            background: isDark ? "rgba(255,255,255,0.7)" : "var(--color-gray)",
            animation: "miniLoader 1.2s ease-in-out infinite",
          }}
        />
        <span
          className="rounded-pill"
          style={{
            width: "6px",
            height: "6px",
            background: isDark ? "rgba(255,255,255,0.7)" : "var(--color-gray)",
            animation: "miniLoader 1.2s ease-in-out 0.15s infinite",
          }}
        />
        <span
          className="rounded-pill"
          style={{
            width: "6px",
            height: "6px",
            background: isDark ? "rgba(255,255,255,0.7)" : "var(--color-gray)",
            animation: "miniLoader 1.2s ease-in-out 0.30s infinite",
          }}
        />
      </span>
      {label && (
        <span
          className="text-small"
          style={{
            color: isDark ? "rgba(255,255,255,0.7)" : "var(--color-gray)",
          }}
        >
          {label}
        </span>
      )}
      <style>{`
        @keyframes miniLoader {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
