import { Lock } from "lucide-react";
import { Avatar, Card, Skeleton, StatCard } from "@battle/ui";
import { useProfile } from "../hooks/useProfile";

export function ProfilePage() {
  const { data, isLoading } = useProfile();

  return (
    <div className="flex flex-col gap-5 px-4 pt-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar src={data?.user.photoUrl} name={data?.user.firstName ?? "?"} size="xl" />
        <div>
          <p className="text-[20px] font-semibold text-primary">
            {data?.user.username ? `@${data.user.username}` : data?.user.firstName}
          </p>
          {data && (
            <p className="mt-0.5 text-[13px] text-secondary">
              Участник с{" "}
              {new Date(data.stats.memberSince).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <StatCard value={data?.stats.bestScore ?? 0} label="Лучший счёт" accent />
          <StatCard value={data?.stats.rank ? `#${data.stats.rank}` : "—"} label="Место" />
          <StatCard value={data?.stats.gamesPlayed ?? 0} label="Игр" />
          <StatCard value={data?.stats.duelsWon ?? 0} label="Побед в дуэлях" />
        </div>
      )}

      <StatCard value={data?.stats.friendsInvited ?? 0} label="Приглашено друзей" />

      <div>
        <h2 className="mb-2 text-[16px] font-semibold text-primary">Достижения</h2>
        <div className="grid grid-cols-3 gap-2">
          {data?.achievements.map((achievement) => (
            <Card
              key={achievement.key}
              padding="sm"
              className={`flex flex-col items-center gap-1 text-center ${
                achievement.unlocked ? "" : "opacity-40"
              }`}
            >
              <span className="text-[24px]">{achievement.icon}</span>
              <span className="text-[12px] font-semibold leading-tight text-primary">
                {achievement.title}
              </span>
              <span className="text-[11px] leading-tight text-secondary">
                {achievement.description}
              </span>
            </Card>
          ))}
          <Card padding="sm" className="flex flex-col items-center gap-1 text-center opacity-40">
            <Lock size={22} className="text-secondary" />
            <span className="text-[12px] font-semibold text-primary">Скоро</span>
          </Card>
        </div>
      </div>
    </div>
  );
}
