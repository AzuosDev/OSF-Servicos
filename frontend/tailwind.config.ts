import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "var(--color-bg-base)",
          card: "var(--color-bg-card)",
          muted: "var(--color-bg-muted)",
          overlay: "var(--color-bg-overlay)",
        },
        accent: {
          lime: "#A3E635",
          orange: "#F97316",
          red: "#EF4444",
          yellow: "#EAB308",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
        },
        category: {
          shopping: "#EF4444",
          food: "#F97316",
          groceries: "#22C55E",
          health: "#06B6D4",
          travel: "#8B5CF6",
          taxi: "#3B82F6",
          other: "#6B7280",
        },
      },
      borderRadius: { card: "16px", pill: "9999px", icon: "12px" },
      fontFamily: {
        sans: ["Syne", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
