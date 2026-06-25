import { AlertTriangle } from 'lucide-react';
import { ModalShell } from './ModalShell';

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onDeleteOne: () => void;
  onDeleteGroup?: () => void;
  onDeleteMonth?: () => void;
  onDeletePermanent?: () => void;
  accountName: string;
  isParcel?: boolean;
  parcelLabel?: string;
  isRecorrente?: boolean;
}

export function ConfirmDeleteModal({
  open,
  onClose,
  onDeleteOne,
  onDeleteGroup,
  onDeleteMonth,
  onDeletePermanent,
  accountName,
  isParcel,
  parcelLabel,
  isRecorrente,
}: ConfirmDeleteModalProps) {
  return (
    <ModalShell open={open} title="Confirmar exclusão" icon={<AlertTriangle className="h-6 w-6 text-accent-red" />} onClose={onClose}>
      <div className="flex flex-col items-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-accent-red" />
        <h2 className="text-lg font-bold text-white">
          {isRecorrente ? 'Excluir conta recorrente?' : isParcel ? `Excluir ${parcelLabel ?? 'parcela'}?` : 'Excluir conta'}
        </h2>
        <p className="text-center text-sm text-text-secondary">
          Deseja apagar a conta "{accountName}"? Esta ação não pode ser desfeita.
        </p>
        <div className="flex w-full flex-col gap-3">
          {isRecorrente ? (
            <>
              <button type="button" onClick={onDeleteMonth} className="rounded-xl bg-accent-red px-4 py-3 text-sm font-bold text-black">
                Excluir apenas este mês
              </button>
              <button type="button" onClick={onDeletePermanent} className="rounded-xl border border-accent-red px-4 py-3 text-sm font-semibold text-accent-red">
                Excluir permanentemente (todos os meses)
              </button>
            </>
          ) : isParcel ? (
            <>
              <button type="button" onClick={onDeleteOne} className="rounded-xl bg-accent-red px-4 py-3 text-sm font-bold text-black">
                Deletar apenas esta parcela
              </button>
              <button type="button" onClick={onDeleteGroup} className="rounded-xl border border-bg-muted px-4 py-3 text-sm text-white">
                Deletar conta inteira
              </button>
            </>
          ) : (
            <button type="button" onClick={onDeleteOne} className="rounded-xl bg-accent-red px-4 py-3 text-sm font-bold text-black">
              Confirmar
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-xl border border-bg-muted px-4 py-2 text-sm text-white">
            Cancelar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
