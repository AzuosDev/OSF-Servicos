import { api } from "./api";

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getPermissionState(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `navigator.serviceWorker.ready` pode nunca resolver (ex.: o SW de
 * desenvolvimento do vite-plugin-pwa falha silenciosamente em `npm run dev`).
 * Sem um limite de tempo, qualquer tela que dependa disso fica presa em
 * "carregando" para sempre. Falha explicitamente em vez de travar a UI.
 */
async function readyServiceWorker(timeoutMs = 8000): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) =>
      setTimeout(() => reject(new Error("O Service Worker não respondeu a tempo. Recarregue a página e tente novamente.")), timeoutMs),
    ),
  ]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await readyServiceWorker();
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new Error("Este navegador não suporta notificações push.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação negada.");
  }

  const { data } = await api.get<{ publicKey: string | null }>("/api/notifications/push/public-key");
  if (!data.publicKey) {
    throw new Error("Push notifications não configurado no servidor.");
  }

  const registration = await readyServiceWorker();

  // Uma inscrição antiga (de um deploy/chave anterior) pode ficar presa no
  // navegador e o push service rejeitar a nova tentativa com "push service
  // error". Descarta qualquer inscrição existente antes de criar uma nova.
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
  }

  const subscribeOptions = {
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  };

  // "Registration failed - push service error" costuma ser uma falha passageira
  // de comunicação com o serviço de push do sistema (ex.: FCM no Android) logo
  // após o Service Worker ativar — tenta de novo algumas vezes com um pequeno
  // intervalo antes de desistir.
  const retryDelaysMs = [1000, 2500];
  let subscription: PushSubscription | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      subscription = await registration.pushManager.subscribe(subscribeOptions);
      break;
    } catch (err) {
      lastError = err;
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (!isAbort || attempt === retryDelaysMs.length) break;
      await sleep(retryDelaysMs[attempt]);
    }
  }

  if (!subscription) {
    if (lastError instanceof DOMException && lastError.name === "AbortError") {
      throw new Error(
        "O serviço de notificações do sistema não respondeu. Verifique sua conexão e se o Google Play Services está atualizado, depois tente novamente.",
      );
    }
    throw lastError;
  }

  await api.post("/api/notifications/push/subscribe", subscription.toJSON());
  return subscription;
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await api.delete("/api/notifications/push/subscribe", { data: { endpoint } });
}
