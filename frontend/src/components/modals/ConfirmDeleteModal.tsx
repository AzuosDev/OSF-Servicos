import { AlertTriangle } from 'lucide-react';
import { ModalShell } from './ModalShell';

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  accountName: string;
}

export function ConfirmDeleteModal({ open, onClose, onConfirm, accountName }: ConfirmDeleteModalProps) {
  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="flex flex-col items-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-accent-red" />
        <h2 className="text-lg font-bold text-white">Excluir conta</h2>
        <p className="text-center text-sm text-text-secondary">
          Deseja apagar a conta "{accountName}"? Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-bg-muted px-4 py-2 text-sm text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center gap-2 rounded-xl bg-accent-red px-4 py-3 text-sm font-bold text-black transition-opacity hover:brightness-110"
          >
            Confirmar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
