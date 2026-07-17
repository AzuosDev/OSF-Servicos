// Horário de funcionamento fixo por enquanto — candidato natural a virar configurável por usuário no futuro.
export const BUSINESS_HOURS = { startMinutes: 8 * 60, endMinutes: 18 * 60 };
export const SLOT_MINUTES = 30;
// 0 = domingo ... 6 = sábado. Domingo não é dia útil.
export const WORKING_WEEKDAYS = [1, 2, 3, 4, 5, 6];
