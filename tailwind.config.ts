import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        purple: { DEFAULT: "#34244B", 600: "#34244B" },
        dark: { DEFAULT: "#221932", 700: "#221932" },
        green: { DEFAULT: "#3CC879", 500: "#3CC879" },
        lavender: { DEFAULT: "#F4F1F8", 50: "#F4F1F8" },
        gray: { DEFAULT: "#8B7FA3", 500: "#8B7FA3" },
        red: { DEFAULT: "#E94B4B", 500: "#E94B4B" },
        warning: "#F5A524",
        info: "#4A8FE7",
      },
      fontFamily: {
        display: ["var(--font-anton)", "Oswald", "Impact", "sans-serif"],
        body: ["var(--font-ubuntu)", "Lato", "Calibri", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-1": ["6rem", { lineHeight: "1.1", fontWeight: "400" }],
        "display-2": ["4.5rem", { lineHeight: "1.1", fontWeight: "400" }],
        h1: ["3.5rem", { lineHeight: "1.2", fontWeight: "700" }],
        h2: ["2.5rem", { lineHeight: "1.2", fontWeight: "700" }],
        h3: ["1.875rem", { lineHeight: "1.2", fontWeight: "700" }],
        h4: ["1.5rem", { lineHeight: "1.3", fontWeight: "500" }],
        "body-l": ["1.25rem", { lineHeight: "1.4", fontWeight: "400" }],
        body: ["1.0625rem", { lineHeight: "1.4", fontWeight: "400" }],
        small: ["0.9375rem", { lineHeight: "1.4", fontWeight: "400" }],
        meta: ["0.75rem", { lineHeight: "1.4", fontWeight: "400" }],
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "7": "32px",
        "8": "40px",
        "9": "48px",
        "10": "64px",
        "11": "96px",
        "12": "128px",
      },
      borderRadius: {
        none: "0",
        sm: "4px",
        md: "8px",
        lg: "16px",
        xl: "24px",
        pill: "999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(34, 25, 50, 0.06)",
        md: "0 4px 8px rgba(34, 25, 50, 0.08)",
        lg: "0 12px 24px rgba(34, 25, 50, 0.12)",
        xl: "0 24px 48px rgba(34, 25, 50, 0.16)",
      },
      maxWidth: {
        container: "1280px",
      },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out-soft": "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
