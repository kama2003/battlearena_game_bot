import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface BottomNavItem {
  value: string;
  label: string;
  icon: ReactNode;
}

export interface BottomNavigationProps {
  items: BottomNavItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function BottomNavigation({ items, value, onChange, className }: BottomNavigationProps) {
  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur",
        "pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[480px] items-stretch justify-between px-2">
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-1 py-2.5"
            >
              <span className={cn("transition-colors duration-150", active ? "text-primary" : "text-secondary/70")}>
                {item.icon}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium transition-colors duration-150",
                  active ? "text-primary" : "text-secondary/70",
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
