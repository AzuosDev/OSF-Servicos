import { useRef, useState } from "react";

import { cn } from "../../lib/utils";

/**
 * Teto da quantidade digitada. O backend aceita qualquer inteiro >= 1; o teto aqui existe só
 * como guarda contra um erro de digitação virar um orçamento absurdo, então é alto de propósito.
 */
export const MAX_QUANTITY = 999_999;

/** Deixa a quantidade dentro da faixa aceita pelo backend (inteiro >= 1). */
export function clampQuantity(quantity: number, min = 1, max = MAX_QUANTITY): number {
  if (!Number.isFinite(quantity)) return min;
  return Math.min(Math.max(Math.floor(quantity), min), max);
}

/**
 * Campo de quantidade digitável. Enquanto o usuário digita, o texto pode estar vazio ou
 * abaixo do mínimo — apagar o "1" para escrever "100" passa por "" e por "10". Esse rascunho
 * fica só aqui e o pai é avisado apenas quando vira um número válido; ao sair do campo o
 * rascunho é descartado e o valor do pai volta a mandar.
 */
export function QuantityInput({
  value,
  onChange,
  label,
  min = 1,
  max = MAX_QUANTITY,
  disabled = false,
  className,
  id,
}: {
  value: number;
  onChange: (quantity: number) => void;
  label: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Última quantidade que ESTE campo reportou. Serve para reconhecer uma mudança vinda de fora.
  const reported = useRef(value);

  // Os botões "+"/"-" ao lado mudam a quantidade sem passar por aqui. Quando isso acontece o
  // rascunho deixa de valer — sem isto o campo continuaria mostrando o número digitado antes,
  // já que nem todo navegador dispara blur ao clicar num botão.
  if (draft !== null && value !== reported.current) {
    reported.current = value;
    setDraft(null);
  }

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    if (digits === "") {
      setDraft("");
      return;
    }
    const parsed = clampQuantity(Number(digits), min, max);
    // Se o número digitado passou do teto, o campo também mostra o teto: exibir um número
    // maior enquanto o orçamento usa o teto seria mentir sobre o que foi cobrado.
    setDraft(Number(digits) > max ? String(parsed) : digits);
    if (Number(digits) >= min) {
      reported.current = parsed;
      onChange(parsed);
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      aria-label={label}
      disabled={disabled}
      value={draft ?? String(value)}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => setDraft(null)}
      className={cn("text-center tabular-nums", className)}
    />
  );
}
