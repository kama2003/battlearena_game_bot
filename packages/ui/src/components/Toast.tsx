import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as RadixToast from "@radix-ui/react-toast";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { cn } from "../lib/cn";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const iconByKind: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={18} className="text-emerald-600" />,
  error: <XCircle size={18} className="text-red-600" />,
  info: <Info size={18} className="text-primary" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, kind }]);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="right" duration={3200}>
        {children}
        {items.map((item) => (
          <RadixToast.Root
            key={item.id}
            onOpenChange={(open) => !open && remove(item.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-card-sm border border-border bg-surface px-4 py-3",
              "shadow-[0_8px_30px_rgba(0,0,0,0.08)] data-[state=open]:animate-[toast-in_0.2s_ease-out]",
            )}
          >
            {iconByKind[item.kind]}
            <RadixToast.Description className="text-[14px] font-medium text-primary">
              {item.message}
            </RadixToast.Description>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed inset-x-4 top-[calc(12px+env(safe-area-inset-top))] z-[100] flex flex-col gap-2" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
