import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#050505",
        surface: "#0D0D0E",
        plot: "#070708",
        ink: {
          DEFAULT: "#F4F4F3",
          raised: "#141416",
          chip: "#1C1C1F",
        },
        muted: {
          DEFAULT: "#8E8E93",
          invert: "rgba(255, 255, 255, 0.55)",
        },
        rule: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          invert: "rgba(255, 255, 255, 0.12)",
        },
        // Revly's electric blue / cyan / violet accent (used strictly as controlled signal)
        lime: "#00D2FF", // Mapping SentinelX accent hook to Revly Electric Cyan
        teal: "#2563FF", // Mapping SentinelX secondary accent to Revly Electric Blue
        forest: "#060A14", // Deep navy subtle tone for hero circles
        accent: {
          blue: "#2563FF",
          cyan: "#00D2FF",
          violet: "#7C3AED",
          emerald: "#10B981",
        },
      },
      borderRadius: {
        card: "24px",
        inner: "18px",
        chip: "8px",
        pill: "9999px",
      },
      padding: {
        gutter: "clamp(1rem, 0.5rem + 2.5vw, 4rem)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 34s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
