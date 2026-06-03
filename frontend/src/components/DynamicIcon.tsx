import * as icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

type IconProps = {
  name?: string;
  className?: string;
  style?: CSSProperties;
};

export function DynamicIcon({ name, className, style }: IconProps) {
  const fallback = icons.Receipt;
  const iconName = name && name in icons ? name : "Receipt";
  const Icon = (icons as unknown as Record<string, LucideIcon>)[iconName] ?? fallback;

  return <Icon className={className} style={style} />;
}
