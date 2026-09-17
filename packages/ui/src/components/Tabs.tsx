import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "../lib/cn";

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <RadixTabs.Root value={value} onValueChange={onChange} className={className}>
      <RadixTabs.List className="flex gap-1 rounded-chip bg-surface-alt p-1">
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              "flex-1 rounded-[10px] px-3 py-2 text-[14px] font-medium text-secondary",
              "transition-colors duration-150 data-[state=active]:bg-surface",
              "data-[state=active]:text-primary data-[state=active]:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
            )}
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
    </RadixTabs.Root>
  );
}
