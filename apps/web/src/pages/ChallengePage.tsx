import { useNavigate, useParams } from "react-router-dom";
import { Swords, X } from "lucide-react";
import { Avatar, Badge, Button, Card, IconButton } from "@battle/ui";
import { useChallenge } from "../hooks/useChallenge";
import { FullScreenLoader } from "../components/FullScreenLoader";
import { ErrorScreen } from "../components/ErrorScreen";

export function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: challenge, isLoading, isError, refetch } = useChallenge(id);

  if (isLoading) return <FullScreenLoader />;
  if (isError || !challenge) {
    return <ErrorScreen title="Вызов не найден" onRetry={() => refetch()} />;
  }

  const alreadyPlayed = challenge.status === "COMPLETED";

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-background px-6">
      <IconButton
        icon={<X size={20} />}
        aria-label="Закрыть"
        onClick={() => navigate("/home")}
        className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))]"
      />

      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/15 text-accent-strong">
        <Swords size={32} />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar src={challenge.challengerPhotoUrl} name={challenge.challengerName} size="lg" />
        <p className="text-[16px] text-secondary">
          Тебя вызвал <span className="font-semibold text-primary">{challenge.challengerName}</span>
        </p>
      </div>

      <Card padding="lg" className="w-full text-center">
        <p className="text-[13px] font-medium uppercase tracking-wide text-secondary">Его результат</p>
        <p className="mt-1 text-[40px] font-bold text-primary">{challenge.targetScore}</p>
        {!alreadyPlayed && (
          <>
            <div className="my-3 h-px bg-border" />
            <p className="text-[14px] text-secondary">
              Твоя цель: <span className="font-semibold text-primary">{challenge.targetScore + 1}+</span>
            </p>
          </>
        )}
      </Card>

      {alreadyPlayed ? (
        <Badge variant={challenge.won ? "success" : "danger"} className="px-4 py-2 text-[14px]">
          {challenge.won ? "🏆 Ты победил" : "Ты проиграл"} · {challenge.opponentScore}
        </Badge>
      ) : (
        <Button size="lg" onClick={() => navigate(`/play?challengeId=${challenge.id}`)}>
          Начать
        </Button>
      )}
    </div>
  );
}
