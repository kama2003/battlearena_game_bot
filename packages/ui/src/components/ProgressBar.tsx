import { cn } from "../lib/cn";

export interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  accent?: boolean;
}

export function ProgressBar({ value, max = 100, className, accent }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-alt", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out",
          accent ? "bg-accent" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
