import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface StatCardProps {
  icon?: ReactNode;
  value: ReactNode;
  label: ReactNode;
  accent?: boolean;
  className?: string;
}

export function StatCard({ icon, value, label, accent, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-card-sm border border-border bg-surface-alt px-3 py-4 text-center",
        className,
      )}
    >
      {icon && (
        <span className={cn("mb-1", accent ? "text-accent" : "text-secondary")}>{icon}</span>
      )}
      <span className="text-[18px] font-semibold leading-none tracking-tight text-primary">
        {value}
      </span>
      <span className="text-[12px] leading-tight text-secondary">{label}</span>
    </div>
  );
}
