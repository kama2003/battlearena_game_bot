import type { ReactNode } from "react";
import { ChevronRight, Check } from "lucide-react";
import { cn } from "../lib/cn";

export interface TaskCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  reward: string;
  completed?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TaskCard({
  icon,
  title,
  description,
  reward,
  completed,
  onClick,
  className,
}: TaskCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={completed || !onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-card-sm border border-border bg-surface p-4 text-left",
        "transition-transform duration-150 active:scale-[0.99] disabled:active:scale-100",
        className,
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-surface-alt text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-primary">{title}</span>
        <span className="block truncate text-[13px] text-secondary">{description}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {completed ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <Check size={16} />
          </span>
        ) : (
          <>
            <span className="text-[13px] font-medium text-accent-strong">{reward}</span>
            <ChevronRight size={18} className="text-secondary" />
          </>
        )}
      </span>
    </button>
  );
}
