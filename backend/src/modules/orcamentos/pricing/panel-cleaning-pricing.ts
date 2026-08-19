const PANEL_CLEANING_SERVICE_NAMES = ['limpeza de placas', 'limpeza de placa'];

export function isPanelCleaningService(serviceName: string): boolean {
  return PANEL_CLEANING_SERVICE_NAMES.includes(serviceName.trim().toLowerCase());
}

// Até 10 placas: R$20/placa. Acima de 10: R$200 (equivalente às 10 primeiras) + R$15 por placa adicional.
export function calculatePanelCleaningSubtotal(quantity: number): number {
  if (quantity <= 10) {
    return quantity * 20;
  }
  return 200 + (quantity - 10) * 15;
}
