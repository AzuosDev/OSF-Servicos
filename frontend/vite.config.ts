import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => ({
  // A pasta de assets estáticos deste projeto se chama "Public" (P maiúsculo).
  // O default do Vite é "public" (minúsculo) — no Windows (case-insensitive)
  // isso passava despercebido, mas builds na Vercel rodam em Linux
  // (case-sensitive) e simplesmente não encontravam a pasta, deixando
  // favicon/manifest/ícones PWA de fora do dist/ em produção.
  publicDir: "Public",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      includeAssets: ["favicon.svg", "manifest.json", "icons/*.svg"],
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,ico,woff,woff2}"],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
    ...(process.env.ANALYZE === "true"
      ? [visualizer({ open: true, filename: "dist/stats.html" })]
      : []),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
}));
