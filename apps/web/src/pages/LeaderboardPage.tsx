import { useState } from "react";
import { Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { LeaderboardPeriod } from "@battle/types";
import {
  Button,
  Card,
  EmptyState,
  InlineError,
  LeaderboardRow,
  PageHeader,
  Skeleton,
  Tabs,
} from "@battle/ui";
import { useLeaderboard } from "../hooks/useLeaderboard";

const PERIOD_TABS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "season", label: "Сезон" },
];

export function LeaderboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<LeaderboardPeriod>("day");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useLeaderboard(period, page);

  function changePeriod(value: string) {
    setPeriod(value as LeaderboardPeriod);
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.totalEntries / data.pageSize)) : 1;
  const currentUserVisible = data?.entries.some((e) => e.isCurrentUser);
  const showPinnedRow = Boolean(data?.currentUser && !currentUserVisible);

  return (
    <div className={showPinnedRow ? "flex flex-col gap-4 px-4 pt-6 pb-20" : "flex flex-col gap-4 px-4 pt-6"}>
      <PageHeader title="Рейтинг" subtitle="Соревнуйся с другими подписчиками" />

      <Tabs items={PERIOD_TABS} value={period} onChange={changePeriod} />

      {isError ? (
        <InlineError onRetry={() => refetch()} />
      ) : (
        <Card padding="sm" className="flex flex-col gap-1">
          {isLoading &&
            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}

          {!isLoading && data?.entries.length === 0 && (
            <EmptyState
              icon={<Trophy size={22} />}
              title="Пока здесь тихо."
              description="Сыграй первым и займи первое место."
              action={
                <Button fullWidth={false} size="md" className="px-6" onClick={() => navigate("/play")}>
                  Играть
                </Button>
              }
            />
          )}

          {data?.entries.map((entry) => (
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

      {data && data.entries.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="text-[14px] font-medium text-secondary disabled:opacity-30"
          >
            Назад
          </button>
          <span className="text-[13px] text-secondary">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-[14px] font-medium text-secondary disabled:opacity-30"
          >
            Дальше
          </button>
        </div>
      )}

      {showPinnedRow && data?.currentUser && (
        <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[480px] px-4">
          <Card padding="sm" className="shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <LeaderboardRow
              rank={data.currentUser.rank}
              name={data.currentUser.firstName}
              photoUrl={data.currentUser.photoUrl}
              score={data.currentUser.score}
              isCurrentUser
            />
          </Card>
        </div>
      )}
    </div>
  );
}
