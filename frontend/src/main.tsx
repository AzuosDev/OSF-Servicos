import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";

import App from "./App";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./styles.css";

registerSW({ immediate: true });

// Com registerType "autoUpdate", o novo service worker assume o controle da aba
// (skipWaiting + clientsClaim) sem recarregar a página automaticamente. Isso deixa
// o bundle JS antigo rodando em memória até um reload manual, causando dados
// inconsistentes/NaN logo após um deploy. Forçamos um reload único ao detectar a
// troca de controller para sempre carregar o bundle mais recente.
if ("serviceWorker" in navigator) {
  let reloadingAfterSwUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingAfterSwUpdate) {
      return;
    }
    reloadingAfterSwUpdate = true;
    window.location.reload();
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 15,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
