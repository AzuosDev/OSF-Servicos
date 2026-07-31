import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BellOff, Loader2 } from "lucide-react";
import {
  getExistingPushSubscription,
  getPermissionState,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "../lib/push";
import { cn } from "../lib/utils";

export function PushNotificationToggle() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const supported = isPushSupported();

  const statusQuery = useQuery({
    queryKey: ["push-subscription"],
    queryFn: async () => Boolean(await getExistingPushSubscription()),
    enabled: supported,
    retry: false,
    staleTime: 1000 * 60,
  });

  const subscribeMutation = useMutation({
    mutationFn: subscribeToPush,
    onSuccess: () => {
      setError(null);
      queryClient.setQueryData(["push-subscription"], true);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Não foi possível ativar as notificações.");
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: unsubscribeFromPush,
    onSuccess: () => {
      setError(null);
      queryClient.setQueryData(["push-subscription"], false);
    },
    onError: () => setError("Não foi possível desativar as notificações."),
  });

  if (!supported) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-bg-muted px-4 py-3 text-sm text-text-secondary">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        Este dispositivo ou navegador não suporta notificações push.
      </div>
    );
  }

  // Se o usuário já bloqueou a permissão pelo navegador, chamar
  // requestPermission() de novo não adianta nada — nem mostra o popup.
  // Avisa isso em vez de deixar o switch parecer que não faz nada.
  if (getPermissionState() === "denied") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-bg-muted px-4 py-3 text-sm text-text-secondary">
        <BellOff className="h-4 w-4 shrink-0" />
        Bloqueadas nas permissões do navegador. Habilite nas configurações do site para ativar.
      </div>
    );
  }

  const enabled = statusQuery.data === true;
  const checking = statusQuery.isLoading;
  const pending = subscribeMutation.isPending || unsubscribeMutation.isPending;

  const handleToggle = () => {
    setError(null);
    if (enabled) unsubscribeMutation.mutate();
    else subscribeMutation.mutate();
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 rounded-xl bg-bg-muted px-4 py-3">
        <span className="text-sm font-medium text-text-primary">
          {checking ? "Verificando..." : enabled ? "Notificações ativadas" : "Notificações desativadas"}
        </span>

        {pending || checking ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-text-muted" />
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Ativar ou desativar notificações push"
            onClick={handleToggle}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              enabled ? "bg-accent-lime" : "bg-bg-overlay",
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform",
                enabled ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-accent-red">{error}</p>}
    </div>
  );
}
