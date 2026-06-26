import { AlertTriangle, Loader2 } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  walletName: string;
  isLoading?: boolean;
};

export function DeleteWalletModal({ isOpen, onClose, onConfirm, walletName, isLoading }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-bg-muted bg-bg-card p-6 space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-red/10">
            <AlertTriangle className="h-7 w-7 text-accent-red" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Excluir carteira</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Tem certeza que deseja excluir a carteira{" "}
              <span className="font-semibold text-white">"{walletName}"</span>?
              Esta ação não poderá ser desfeita e carteiras com histórico de
              transações não podem ser apagadas.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-bg-muted py-2.5 text-sm font-semibold text-white transition hover:bg-bg-muted disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-red py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-70"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir Carteira
          </button>
        </div>
      </div>
    </div>
  );
}
