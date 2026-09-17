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

const medalByRank: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export function LeaderboardRow({
  rank,
  name,
  photoUrl,
  score,
  isCurrentUser,
  className,
}: LeaderboardRowProps) {
  const medal = medalByRank[rank];

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
          "flex w-7 shrink-0 items-center justify-center text-[15px] font-semibold",
          medal ? "text-[18px]" : "text-secondary",
        )}
      >
        {medal ?? rank}
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
