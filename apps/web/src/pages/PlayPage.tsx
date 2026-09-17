import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button, useToast } from "@battle/ui";
import { useAttempts, useFinishGame, usePlayChallenge, useStartGame } from "../hooks/useGame";
import { useChallenge } from "../hooks/useChallenge";
import { hapticImpact, hapticNotify } from "../lib/telegram";
import { ApiError } from "../lib/apiClient";

type Phase = "idle" | "countdown" | "playing" | "finishing";

export function PlayPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get("challengeId") ?? undefined;

  const { data: attempts } = useAttempts();
  const { data: challenge } = useChallenge(challengeId);
  const startGame = useStartGame();
  const playChallenge = usePlayChallenge();
  const finishGame = useFinishGame();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<{ id: string; duration: number } | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const endAtRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const finishedRef = useRef(false);

  const remaining = attempts?.remaining ?? null;
  const noAttempts = remaining !== null && remaining <= 0;

  async function handleStart() {
    try {
      const result = challengeId
        ? await playChallenge.mutateAsync(challengeId)
        : await startGame.mutateAsync(challengeId);
      scoreRef.current = 0;
      finishedRef.current = false;
      setScore(0);
      setSession({ id: result.gameSessionId, duration: result.duration });
      endAtRef.current = Date.now() + result.duration * 1000;
      setTimeLeft(result.duration);
      setPhase("playing");
    } catch (error) {
      toast.show(
        error instanceof ApiError ? error.message : "Не удалось начать игру",
        "error",
      );
    }
  }

  useEffect(() => {
    if (phase !== "playing") return;

    const interval = setInterval(() => {
      const msLeft = endAtRef.current - Date.now();
      setTimeLeft(Math.max(0, Math.ceil(msLeft / 1000)));
      if (msLeft <= 0) {
        clearInterval(interval);
        void finish();
      }
    }, 100);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function finish() {
    if (finishedRef.current || !session) return;
    finishedRef.current = true;
    setPhase("finishing");

    try {
      const result = await finishGame.mutateAsync({
        gameSessionId: session.id,
        score: scoreRef.current,
      });
      hapticNotify("success");
      navigate("/result", { state: { result } });
    } catch (error) {
      toast.show(
        error instanceof ApiError ? error.message : "Не удалось сохранить результат",
        "error",
      );
      setPhase("idle");
    }
  }

  function handleTap() {
    if (phase !== "playing") return;
    scoreRef.current += 1;
    setScore(scoreRef.current);
    if (scoreRef.current % 4 === 0) hapticImpact("light");
  }

  if (phase === "playing" || phase === "finishing") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center bg-background px-6 pb-10 pt-16">
        <div className="flex w-full items-center justify-between px-2">
          <div className="text-center">
            <p className="text-[13px] font-medium uppercase tracking-wide text-secondary">Время</p>
            <p className="text-[28px] font-bold tabular-nums text-primary">00:{String(timeLeft).padStart(2, "0")}</p>
          </div>
          <div className="text-center">
            <p className="text-[13px] font-medium uppercase tracking-wide text-secondary">Счёт</p>
            <p className="text-[28px] font-bold tabular-nums text-primary">{score}</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <motion.button
            type="button"
            onClick={handleTap}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.08 }}
            disabled={phase === "finishing"}
            className="flex h-[200px] w-[200px] select-none items-center justify-center rounded-full bg-btn-primary text-[24px] font-bold tracking-wide text-btn-primary-fg shadow-[0_20px_50px_rgba(0,0,0,0.18)] active:shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
          >
            {phase === "finishing" ? "..." : "ЖМИ!"}
          </motion.button>
        </div>

        <p className="text-[13px] text-secondary">
          {phase === "finishing" ? "Сохраняем результат..." : "Нажимай как можно быстрее"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-background px-6">
      {challenge && (
        <div className="text-center">
          <p className="text-[14px] text-secondary">Тебя вызвал {challenge.challengerName}</p>
          <p className="mt-1 text-[15px] font-medium text-primary">
            Его результат: <span className="font-bold">{challenge.targetScore}</span>
          </p>
        </div>
      )}

      <div className="flex h-[180px] w-[180px] items-center justify-center rounded-full border-2 border-dashed border-border">
        <span className="text-[15px] font-medium text-secondary">10 секунд</span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-1.5">
          {Array.from({ length: attempts?.total ?? 3 }).map((_, i) => (
            <span
              key={i}
              className={
                remaining !== null && i < remaining
                  ? "h-2.5 w-2.5 rounded-full bg-primary"
                  : "h-2.5 w-2.5 rounded-full bg-border"
              }
            />
          ))}
        </div>
        {noAttempts && attempts?.nextFreeAt && (
          <p className="text-[13px] text-secondary">
            Следующая попытка после{" "}
            {new Date(attempts.nextFreeAt).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      <Button
        size="lg"
        onClick={handleStart}
        loading={startGame.isPending || playChallenge.isPending}
        disabled={noAttempts}
      >
        {challengeId ? "Принять вызов" : "Начать"}
      </Button>
    </div>
  );
}
