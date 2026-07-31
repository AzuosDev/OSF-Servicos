/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// Assume o controle imediatamente sem esperar o reload do usuário
self.skipWaiting();
clientsClaim();

// ─── Precache ────────────────────────────────────────────────────────────────
// __WB_MANIFEST é substituído pelo vite-plugin-pwa com a lista de assets do build
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ─── Navegação SPA ───────────────────────────────────────────────────────────
// Toda rota que não seja /api cai no index.html (React Router cuida do resto)
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  }),
);

// ─── Google Fonts (CSS) ──────────────────────────────────────────────────────
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// ─── Google Fonts (arquivos de fonte) ────────────────────────────────────────
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// ─── API ─────────────────────────────────────────────────────────────────────
// Network first: tenta rede, usa cache quando offline (TTL 24h, até 150 entradas)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-responses',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  }),
);

// ─── Push notifications ──────────────────────────────────────────────────────
// Disparado apenas pelo endpoint de cron externo (ver notifications-cron.service.ts),
// para alertar o usuário mesmo com o app fechado.
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string } = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'AK LavaJato', body: event.data.text() };
  }

  const iconUrl = new URL('/pwa-192x192.png', self.location.origin).href;

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'AK LavaJato', {
      body: payload.body ?? '',
      icon: iconUrl,
      badge: iconUrl,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/dashboard');
    }),
  );
});
