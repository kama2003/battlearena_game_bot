import { RefreshCw } from "lucide-react";
import { cn } from "../lib/cn";

export interface InlineErrorProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * A compact error affordance for one section of an already-loaded page
 * (e.g. a leaderboard list that failed to refresh) — as opposed to a
 * full-screen error for a failed initial app load.
 */
export function InlineError({
  title = "Не удалось загрузить данные.",
  description = "Проверь соединение и попробуй снова.",
  onRetry,
  className,
}: InlineErrorProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card-sm border border-border bg-surface px-5 py-8 text-center",
        className,
      )}
    >
      <div>
        <p className="text-[15px] font-semibold text-primary">{title}</p>
        <p className="mt-1 text-[13px] text-secondary">{description}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-chip bg-surface-alt px-3.5 py-2 text-[13px] font-medium text-primary"
        >
          <RefreshCw size={14} />
          Повторить
        </button>
      )}
    </div>
  );
}
