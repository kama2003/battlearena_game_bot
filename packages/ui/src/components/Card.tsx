import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

const paddingMap = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({ className, padding = "md", interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card bg-surface border border-border",
        "shadow-[0_4px_20px_rgba(0,0,0,0.03)]",
        interactive && "transition-transform duration-150 active:scale-[0.99] cursor-pointer",
        paddingMap[padding],
        className,
      )}
      {...props}
    />
  );
}
