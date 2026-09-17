import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/cn";

type ConflictingHtmlProps =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, ConflictingHtmlProps> {
  icon: ReactNode;
  variant?: "solid" | "subtle" | "outline";
  size?: "sm" | "md" | "lg";
  "aria-label": string;
}

const sizeMap = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

const variantMap = {
  solid: "bg-btn-primary text-btn-primary-fg",
  subtle: "bg-surface-alt text-primary",
  outline: "bg-transparent border border-border text-primary",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, variant = "subtle", size = "md", className, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.92 }}
        transition={{ duration: 0.12 }}
        className={cn(
          "inline-flex items-center justify-center rounded-full shrink-0",
          "transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
          sizeMap[size],
          variantMap[variant],
          className,
        )}
        {...props}
      >
        {icon}
      </motion.button>
    );
  },
);
IconButton.displayName = "IconButton";
