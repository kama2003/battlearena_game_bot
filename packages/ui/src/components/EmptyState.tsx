import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-alt text-secondary">
          {icon}
        </div>
      )}
      <div>
        <p className="text-[16px] font-semibold text-primary">{title}</p>
        {description && <p className="mt-1 text-[14px] text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
