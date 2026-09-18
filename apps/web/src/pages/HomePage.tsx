import { useNavigate } from "react-router-dom";
import { ArrowRight, Trophy, Users, Star, UserPlus } from "lucide-react";
import { Avatar, Badge, Button, Card, InlineError, LeaderboardRow, Skeleton, StatCard } from "@battle/ui";
import { useMe } from "../hooks/useMe";
import { useSeason } from "../hooks/useSeason";
import { useLeaderboard } from "../hooks/useLeaderboard";

export function HomePage() {
  const navigate = useNavigate();
  const me = useMe();
  const season = useSeason();
  const top = useLeaderboard("week", 1);

  return (
    <div className="flex flex-col gap-5 px-4 pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar src={me.data?.user.photoUrl} name={me.data?.user.firstName ?? "?"} size="lg" />
          <div>
            <p className="text-[14px] text-secondary">Привет,</p>
            <p className="text-[24px] font-semibold leading-tight tracking-tight text-primary">
              {me.data?.user.firstName ?? "Игрок"}!
            </p>
          </div>
        </div>
        {me.data?.rank && (
          <Badge variant="neutral" className="shrink-0 px-3 py-1.5 text-[13px]">
            #{me.data.rank} твоё место
          </Badge>
        )}
      </div>

      <Card padding="lg" className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <p className="text-[20px] font-semibold text-primary">{season.data?.name ?? "Сезон"}</p>
          <Badge variant="neutral">
            До конца: {season.data ? `${season.data.daysRemaining} дн.` : "…"}
          </Badge>
        </div>

        {season.isLoading ? (
          <div className="flex gap-2">
            <Skeleton className="h-20 flex-1" />
            <Skeleton className="h-20 flex-1" />
            <Skeleton className="h-20 flex-1" />
          </div>
        ) : season.isError ? (
          <InlineError onRetry={() => season.refetch()} />
        ) : (
          <div className="flex gap-2">
            <StatCard
              icon={<Trophy size={18} />}
              value={season.data?.prizeDescription ?? "—"}
              label="Приз сезона"
              accent
            />
            <StatCard icon={<Users size={18} />} value={season.data?.participants ?? 0} label="Участников" />
            <StatCard icon={<Star size={18} />} value={season.data?.personalBest ?? 0} label="Твой рекорд" />
          </div>
        )}

        <Button size="lg" icon={<ArrowRight size={18} />} onClick={() => navigate("/play")}>
          Играть
        </Button>
      </Card>

      <Card
        padding="md"
        interactive
        className="flex items-center gap-3"
        onClick={() => navigate("/invite")}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-surface-alt text-primary">
          <UserPlus size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-primary">Пригласи друга</span>
          <span className="block text-[13px] text-secondary">+1 попытка за каждого</span>
        </span>
        <ArrowRight size={18} className="shrink-0 text-secondary" />
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-primary">TOP игроков</h2>
          <button
            type="button"
            onClick={() => navigate("/leaderboard")}
            className="text-[13px] font-medium text-secondary"
          >
            Смотреть рейтинг
          </button>
        </div>
        {top.isError ? (
          <InlineError onRetry={() => top.refetch()} />
        ) : (
          <Card padding="sm" className="flex flex-col gap-1">
            {top.isLoading &&
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            {top.data?.entries.slice(0, 3).map((entry) => (
              <LeaderboardRow
                key={entry.userId}
                rank={entry.rank}
                name={entry.firstName}
                photoUrl={entry.photoUrl}
                score={entry.score}
                isCurrentUser={entry.isCurrentUser}
              />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
