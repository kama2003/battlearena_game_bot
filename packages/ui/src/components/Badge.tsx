import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type BadgeVariant = "neutral" | "accent" | "success" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantMap: Record<BadgeVariant, string> = {
  neutral: "bg-surface-alt text-secondary border border-border",
  accent: "bg-accent/15 text-accent-strong",
  success: "bg-emerald-500/10 text-emerald-700",
  danger: "bg-red-500/10 text-red-700",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-chip px-2.5 py-1 text-[12px] font-medium leading-none",
        variantMap[variant],
        className,
      )}
      {...props}
    />
  );
}
