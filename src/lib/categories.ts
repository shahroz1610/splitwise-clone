import {
  Car,
  Film,
  Home,
  Lightbulb,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  HeartPulse,
  Gift,
  type LucideIcon,
} from "lucide-react";

export interface Category {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: "general", label: "General", icon: Receipt, color: "#71717a" },
  { id: "food", label: "Food & drink", icon: Utensils, color: "#f59e0b" },
  { id: "groceries", label: "Groceries", icon: ShoppingCart, color: "#84cc16" },
  { id: "rent", label: "Rent & home", icon: Home, color: "#6366f1" },
  { id: "utilities", label: "Utilities", icon: Lightbulb, color: "#eab308" },
  { id: "transport", label: "Transport", icon: Car, color: "#0ea5e9" },
  { id: "travel", label: "Travel", icon: Plane, color: "#14b8a6" },
  { id: "entertainment", label: "Entertainment", icon: Film, color: "#ec4899" },
  { id: "shopping", label: "Shopping", icon: ShoppingBag, color: "#a855f7" },
  { id: "health", label: "Health", icon: HeartPulse, color: "#ef4444" },
  { id: "gifts", label: "Gifts", icon: Gift, color: "#f97316" },
];

export const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

export function getCategory(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export const MEMBER_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#64748b"];
