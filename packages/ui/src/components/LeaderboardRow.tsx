import { cn } from "../lib/cn";
import { Avatar } from "./Avatar";

export interface LeaderboardRowProps {
  rank: number;
  name: string;
  photoUrl?: string | null;
  score: number;
  isCurrentUser?: boolean;
  className?: string;
}

/** Ranks 1-3 get a filled badge instead of a plain number — #1 in accent, matching the "first place" accent use case; #2/#3 stay neutral. */
const topRankStyles: Record<number, string> = {
  1: "bg-accent text-white",
  2: "bg-primary text-white",
  3: "bg-surface-alt text-primary ring-1 ring-inset ring-border",
};

export function LeaderboardRow({
  rank,
  name,
  photoUrl,
  score,
  isCurrentUser,
  className,
}: LeaderboardRowProps) {
  const topStyle = topRankStyles[rank];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-card-sm px-3 py-2.5",
        isCurrentUser ? "bg-primary/[0.04] ring-1 ring-inset ring-border" : "",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums",
          topStyle ?? "text-[15px] font-medium text-secondary",
        )}
      >
        {rank}
      </span>
      <Avatar src={photoUrl} name={name} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-primary">
        {name}
        {isCurrentUser && <span className="ml-1.5 text-secondary">(вы)</span>}
      </span>
      <span className="shrink-0 text-[15px] font-semibold tabular-nums text-primary">{score}</span>
    </div>
  );
}
