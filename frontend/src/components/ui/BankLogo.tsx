import { useState } from "react";
import { getBankLogoUrl, getWalletIcon } from "../../lib/bankIcons";
import { cn } from "../../lib/utils";

interface BankLogoProps {
  nome: string;
  icone?: string;
  className?: string;
}

export function BankLogo({ nome, icone, className = "h-6 w-6" }: BankLogoProps) {
  const [error, setError] = useState(false);
  const url = getBankLogoUrl(nome);

  if (url && !error) {
    return (
      <img
        src={url}
        alt={nome}
        onError={() => setError(true)}
        className={cn("rounded-full object-contain", className)}
      />
    );
  }

  return <span className="leading-none">{getWalletIcon({ nome, icone })}</span>;
}
