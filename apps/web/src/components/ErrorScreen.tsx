import { AlertTriangle } from "lucide-react";
import { Button } from "@battle/ui";

export interface ErrorScreenProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorScreen({
  title = "Что-то пошло не так.",
  description = "Проверь соединение и попробуй снова.",
  onRetry,
}: ErrorScreenProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-alt text-secondary">
        <AlertTriangle size={28} />
      </div>
      <div>
        <p className="text-[18px] font-semibold text-primary">{title}</p>
        <p className="mt-1 text-[14px] text-secondary">{description}</p>
      </div>
      {onRetry && (
        <Button size="md" fullWidth={false} onClick={onRetry} className="px-8">
          Повторить
        </Button>
      )}
    </div>
  );
}
