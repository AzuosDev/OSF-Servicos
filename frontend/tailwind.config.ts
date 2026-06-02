import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0A0A0A",
          card: "#141414",
          muted: "#1C1C1C",
          overlay: "#232323",
        },
        accent: {
          lime: "#A3E635",
          orange: "#F97316",
          red: "#EF4444",
          yellow: "#EAB308",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#9CA3AF",
          muted: "#4B5563",
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
