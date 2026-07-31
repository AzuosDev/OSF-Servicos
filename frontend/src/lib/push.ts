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
  console.log("[push] subscribeToPush: início", {
    supported: isPushSupported(),
    permission: getPermissionState(),
    isSecureContext: window.isSecureContext,
  });

  if (!isPushSupported()) {
    console.error("[push] navegador não suporta push (serviceWorker/PushManager/Notification)");
    throw new Error("Este navegador não suporta notificações push.");
  }

  const permission = await Notification.requestPermission();
  console.log("[push] Notification.requestPermission ->", permission);
  if (permission !== "granted") {
    throw new Error("Permissão de notificação negada.");
  }

  let publicKey: string | null;
  try {
    const { data } = await api.get<{ publicKey: string | null }>("/api/notifications/push/public-key");
    publicKey = data.publicKey;
    console.log("[push] public-key ->", publicKey ? `presente (len=${publicKey.length})` : "ausente");
  } catch (err) {
    console.error("[push] erro ao buscar a chave VAPID no backend", err);
    throw err;
  }
  if (!publicKey) {
    throw new Error("Push notifications não configurado no servidor.");
  }

  const registration = await readyServiceWorker();
  console.log("[push] serviceWorker.ready ok", { scope: registration.scope, active: !!registration.active });

  // Reaproveita a inscrição já existente em vez de descartar e recriar — menos
  // round-trips com o push service, que já é o ponto mais frágil desse fluxo.
  let subscription = await registration.pushManager.getSubscription();
  console.log("[push] inscrição já existente?", !!subscription);

  if (!subscription) {
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    };

    // "Registration failed - push service error" costuma ser uma falha passageira
    // de comunicação com o serviço de push do sistema (ex.: FCM no Android) logo
    // após o Service Worker ativar — tenta de novo algumas vezes com um pequeno
    // intervalo antes de desistir.
    const retryDelaysMs = [1000, 2500];
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
      try {
        subscription = await registration.pushManager.subscribe(subscribeOptions);
        console.log("[push] pushManager.subscribe ok", { endpoint: subscription.endpoint, attempt });
        break;
      } catch (err) {
        lastError = err;
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        console.error(`[push] erro em pushManager.subscribe (tentativa ${attempt + 1})`, err);
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
  }

  try {
    await api.post("/api/notifications/push/subscribe", subscription.toJSON());
    console.log("[push] inscrição enviada ao backend com sucesso");
  } catch (err) {
    console.error("[push] erro ao enviar a inscrição para o backend", err);
    throw err;
  }

  return subscription;
}

export async function unsubscribeFromPush(): Promise<void> {
  console.log("[push] unsubscribeFromPush: início");
  const subscription = await getExistingPushSubscription();
  if (!subscription) {
    console.log("[push] nenhuma inscrição ativa encontrada para cancelar");
    return;
  }

  const endpoint = subscription.endpoint;
  const deactivated = await subscription.unsubscribe();
  console.log("[push] subscription.unsubscribe no navegador ->", deactivated);

  await api.delete("/api/notifications/push/subscribe", { data: { endpoint } });
  console.log("[push] inscrição removida do backend com sucesso");
}
