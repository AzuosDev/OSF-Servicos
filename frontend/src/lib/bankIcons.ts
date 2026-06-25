const BANK_ICONS: Record<string, string> = {
  nubank: "💜",
  "banco inter": "🟠",
  inter: "🟠",
  "itaú unibanco": "🟠",
  itaú: "🟠",
  itau: "🟠",
  bradesco: "🔴",
  santander: "🔴",
  "caixa econômica": "🏛️",
  "caixa economica": "🏛️",
  caixa: "🏛️",
  "banco do brasil": "🟡",
  "c6 bank": "⬛",
  "xp investimentos": "📈",
  "xp inc": "📈",
  picpay: "💚",
  "mercado pago": "💛",
  pagbank: "🔵",
  pagseguro: "🔵",
  "btg pactual": "⚫",
  btg: "⚫",
  sicredi: "🌱",
  sicoob: "🤝",
  neon: "🔷",
  next: "💙",
  wise: "🌊",
  revolut: "⚪",
  stone: "🟩",
  bs2: "🔵",
  safra: "🏦",
  avenue: "🇺🇸",
  nomad: "✈️",
  rico: "💰",
  clear: "💎",
  warren: "💼",
  original: "🟢",
};

export function detectBankIcon(nome: string): string | null {
  const s = nome.toLowerCase().trim();
  if (!s) return null;
  const match = Object.entries(BANK_ICONS)
    .filter(([k]) => s.includes(k))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return match?.[1] ?? null;
}

export function getWalletIcon(wallet: { nome: string; icone?: string }): string {
  if (wallet.icone && wallet.icone !== "🏦") return wallet.icone;
  return detectBankIcon(wallet.nome) ?? wallet.icone ?? "🏦";
}
