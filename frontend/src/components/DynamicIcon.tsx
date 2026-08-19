import {
  ArrowLeftRight,
  Banknote,
  BatteryCharging,
  Briefcase,
  Cable,
  Car,
  Cpu,
  CreditCard,
  Dumbbell,
  FileText,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Lightbulb,
  MoreHorizontal,
  Package,
  Percent,
  Plane,
  Plug,
  PlugZap,
  Receipt,
  RefreshCcw,
  Repeat,
  Settings2,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sun,
  SunMedium,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

const iconRegistry: Record<string, LucideIcon> = {
  ArrowLeftRight,
  Banknote,
  BatteryCharging,
  Briefcase,
  Cable,
  Car,
  Cpu,
  CreditCard,
  Dumbbell,
  FileText,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Lightbulb,
  MoreHorizontal,
  Package,
  Percent,
  Plane,
  Plug,
  PlugZap,
  Receipt,
  RefreshCcw,
  Repeat,
  Settings2,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sun,
  SunMedium,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Wrench,
  Zap,
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
