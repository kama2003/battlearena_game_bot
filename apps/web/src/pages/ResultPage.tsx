import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Swords, Share2 } from "lucide-react";
import type { GameFinishResponse } from "@battle/types";
import { Button, Card, StatCard, useToast } from "@battle/ui";
import { useCreateChallenge } from "../hooks/useChallenge";
import { useReferrals } from "../hooks/useReferrals";
import { shareViaTelegram } from "../lib/telegram";
import { ApiError } from "../lib/apiClient";

function resultMessage(result: GameFinishResponse): { emoji: string; headline: string; note: string } {
  if (result.challenge) {
    return result.challenge.won
      ? { emoji: "🏆", headline: "Победа!", note: `Ты обошёл соперника (${result.challenge.opponentScore}).` }
      : { emoji: "😤", headline: "Поражение", note: `Соперник набрал ${result.challenge.opponentScore}. Реванш?` };
  }
  if (result.isTop50) {
    return { emoji: "🔥", headline: "Отличный результат!", note: "Ты вошёл в TOP-50! Продолжай, ты можешь больше." };
  }
  return { emoji: "💪", headline: "Неплохо!", note: "Сыграй ещё раз, чтобы улучшить результат." };
}

export function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const createChallenge = useCreateChallenge();
  const referrals = useReferrals();

  const result = (location.state as { result?: GameFinishResponse } | null)?.result;

  useEffect(() => {
    if (!result) navigate("/play", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (!result) return null;

  const { emoji, headline, note } = resultMessage(result);

  async function handleChallengeFriend() {
    try {
      const challenge = await createChallenge.mutateAsync(result!.score);
      shareViaTelegram(
        `🔥 Я набрал ${result!.score} очков в BATTLE.\n\nСможешь меня победить?\n👇 Прими вызов`,
        challenge.shareLink,
      );
    } catch (error) {
      toast.show(error instanceof ApiError ? error.message : "Не удалось создать вызов", "error");
    }
  }

  function handleShareResult() {
    const link = referrals.data?.referralLink ?? "https://t.me";
    shareViaTelegram(`🔥 Я набрал ${result!.score} очков в BATTLE.\n\nПрисоединяйся!`, link);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col justify-between bg-background px-6 pb-8 pt-16">
      <div className="flex flex-col items-center text-center">
        <span className="text-[56px] leading-none">{emoji}</span>
        <p className="mt-4 text-[56px] font-bold leading-none tracking-tight text-primary">
          {result.score}
        </p>
        <p className="mt-3 text-[18px] font-semibold text-primary">{headline}</p>
        <p className="mt-1 max-w-[260px] text-[14px] text-secondary">{note}</p>

        <div className="mt-8 flex w-full gap-2">
          <StatCard value={result.rank ? `#${result.rank}` : "—"} label="Твоё место" />
          <StatCard value={result.dayBestScore} label="Рекорд дня" />
          <StatCard value={result.totalScore} label="Всего очков" />
        </div>

        {result.pointsToTop10 !== null && (
          <Card padding="sm" className="mt-4 w-full bg-surface-alt border-0">
            <p className="text-[13px] font-medium text-primary">
              До TOP-10 тебе не хватает {result.pointsToTop10} очков.
            </p>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Button size="lg" onClick={() => navigate("/play")}>
          Играть ещё
        </Button>
        <Button
          size="lg"
          variant="secondary"
          icon={<Swords size={18} />}
          iconPosition="left"
          onClick={handleChallengeFriend}
          loading={createChallenge.isPending}
        >
          Вызвать друга
        </Button>
        <Button
          size="md"
          variant="ghost"
          icon={<Share2 size={16} />}
          iconPosition="left"
          onClick={handleShareResult}
        >
          Поделиться результатом
        </Button>
      </div>
    </div>
  );
}
