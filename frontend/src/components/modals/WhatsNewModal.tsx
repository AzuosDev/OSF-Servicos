import { Rocket } from "lucide-react";
import { ModalShell } from "./ModalShell";

// Altere esta constante a cada novo deploy para exibir o modal novamente
const WHATS_NEW_VERSION = "2025-07-v1";
const STORAGE_KEY = "whats-new-seen";

export function hasSeenWhatsNew() {
  return localStorage.getItem(STORAGE_KEY) === WHATS_NEW_VERSION;
}

export function markWhatsNewAsSeen() {
  localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION);
}

const sections = [
  {
    emoji: "🏦",
    title: "Carteiras",
    items: [
      "Vinculação de transações a carteiras com ajuste automático de saldo",
      "Transferência entre carteiras com proteção contra exclusão acidental",
      "Logos de banco, ícones automáticos e opção de ocultar valores",
      "Extrato paginado por carteira",
    ],
  },
  {
    emoji: "📋",
    title: "Contas a Pagar / Receber",
    items: [
      'Tela de Contas reformulada com seções "Pendentes" e "Pagas", resumo por status e estado vazio',
      "Modal unificado de criação e edição com campos de parcelamento e recorrência restaurados",
      "Pagamento dinâmico com seleção de carteira e estorno automático em cascata",
      "Correção: edição de data em contas parceladas agora persiste corretamente",
    ],
  },
  {
    emoji: "💸",
    title: "Transações",
    items: [
      'Saldo Histórico (Sem Carteira): transações legadas sem carteira agora aparecem como um saldo virtual',
      "Migração em lote — associe transações antigas a uma carteira diretamente na tela",
      "Placeholder dinâmico de descrição baseado na categoria selecionada",
    ],
  },
  {
    emoji: "✨",
    title: "Experiência geral",
    items: [
      "Interface totalmente responsiva no mobile, sem sobreposição com a barra inferior",
      "Correção de fuso horário em recorrências e atomicidade ao quitar contas",
      "Performance: lazy loading, bundle splitting e tree-shaking de ícones",
    ],
  },
];

export function WhatsNewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  function handleClose() {
    markWhatsNewAsSeen();
    onClose();
  }

  return (
    <ModalShell
      open={open}
      title="O que há de novo 🚀"
      icon={<Rocket className="h-5 w-5 text-accent-lime" />}
      onClose={handleClose}
      footer={
        <button
          type="button"
          onClick={handleClose}
          className="w-full rounded-xl bg-accent-lime py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
        >
          Entendido!
        </button>
      }
    >
      <div className="flex flex-col gap-5 pb-1">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 text-sm font-bold text-white">
              {section.emoji} {section.title}
            </p>
            <ul className="flex flex-col gap-1.5">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-text-secondary">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-lime" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
