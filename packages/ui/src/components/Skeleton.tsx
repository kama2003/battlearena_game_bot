import { cn } from "../lib/cn";

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-card-sm bg-surface-alt",
        className,
      )}
    />
  );
}
