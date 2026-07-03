import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { appendDigit, formatCents, fromCents, removeDigit, toCents } from "../../lib/currency";

export type CurrencyInputProps = {
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export function CurrencyInput({
  value,
  onChange,
  onBlur,
  disabled = false,
  className,
  id,
}: CurrencyInputProps) {
  const [cents, setCents] = useState(() => toCents(value));
  const inputRef = useRef<HTMLInputElement>(null);
  // Rastreia o último valor de centavos definido por NÓS para evitar loop
  // de sincronização quando o pai atualiza value em resposta ao onChange.
  const ownCents = useRef(cents);

  useEffect(() => {
    const incoming = toCents(value);
    if (incoming !== ownCents.current) {
      ownCents.current = incoming;
      setCents(incoming);
    }
  }, [value]);

  // Força cursor ao final após cada atualização de estado
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement === el) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [cents]);

  function update(newCents: number) {
    ownCents.current = newCents;
    setCents(newCents);
    onChange(fromCents(newCents));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (disabled) return;
    // Extrai somente os dígitos do que o browser renderizou (cobre desktop e mobile)
    const digits = e.target.value.replace(/\D/g, "");
    const newCents = digits ? Math.min(parseInt(digits, 10), 99_999_999_99) : 0;
    update(newCents);
  }

  // Backspace no desktop: o onChange já captura a deleção, mas o browser pode
  // não atualizar o valor de forma confiável em inputs controlados. Garantimos
  // aqui o comportamento de remoção do último dígito (padrão calculadora).
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (e.key === "Backspace") {
      e.preventDefault();
      update(removeDigit(cents));
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault();
      update(appendDigit(cents, parseInt(e.key, 10)));
    }
  }

  function moveCursorToEnd(e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    // requestAnimationFrame garante que ocorre APÓS o browser posicionar o cursor
    requestAnimationFrame(() => {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  }

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatCents(cents)}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={moveCursorToEnd}
      onClick={moveCursorToEnd}
      onBlur={onBlur}
      disabled={disabled}
      className={className}
    />
  );
}
