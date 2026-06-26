import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Car,
  CreditCard,
  Dumbbell,
  FileText,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  MoreHorizontal,
  Package,
  Percent,
  Plane,
  Receipt,
  RefreshCcw,
  Repeat,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

const iconRegistry: Record<string, LucideIcon> = {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Car,
  CreditCard,
  Dumbbell,
  FileText,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  MoreHorizontal,
  Package,
  Percent,
  Plane,
  Receipt,
  RefreshCcw,
  Repeat,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Wrench,
};

type IconProps = {
  name?: string;
  className?: string;
  style?: CSSProperties;
};

export function DynamicIcon({ name, className, style }: IconProps) {
  const Icon = (name && iconRegistry[name]) || iconRegistry.Receipt;
  return <Icon className={className} style={style} />;
}
