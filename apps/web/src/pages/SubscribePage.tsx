import { Trophy, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@battle/ui";
import { useCheckSubscription, useSubscriptionStatus } from "../hooks/useSubscription";
import { getTelegramWebApp, hapticNotify } from "../lib/telegram";

const BULLETS = [
  "Простая игра — 10 секунд",
  "Рейтинг среди подписчиков",
  "Призы каждую неделю",
];

export function SubscribePage() {
  const { data } = useSubscriptionStatus();
  const check = useCheckSubscription();

  // Channels the user still has to join; falls back to the primary one until
  // the status has loaded.
  const missing = (data?.channels ?? []).filter((c) => !c.subscribed);
  const targets =
    missing.length > 0
      ? missing
      : data?.channelUsername
        ? [{ username: data.channelUsername, title: `@${data.channelUsername}` }]
        : [];

  function openChannel(username: string) {
    const url = `https://t.me/${username}`;
    const app = getTelegramWebApp();
    if (app) app.openTelegramLink(url);
    else window.open(url, "_blank");
  }

  async function handleCheck() {
    const result = await check.mutateAsync();
    hapticNotify(result.subscribed ? "success" : "error");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col justify-between bg-background px-6 pb-8 pt-14">
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-accent/25 via-accent/10 to-transparent"
        >
          <Trophy size={56} className="text-accent-strong" strokeWidth={1.5} />
        </motion.div>

        <h1 className="mt-8 text-[34px] font-bold tracking-tight text-primary">BATTLE</h1>
        <p className="mt-3 max-w-[280px] text-[16px] leading-relaxed text-secondary">
          Соревнуйся, приглашай,
          <br />
          расти вместе с нами.
        </p>

        <ul className="mt-8 flex flex-col gap-3 self-stretch">
          {BULLETS.map((bullet) => (
            <li
              key={bullet}
              className="flex items-center gap-3 rounded-card-sm bg-surface px-4 py-3 text-left border border-border"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-alt text-primary">
                <Check size={14} strokeWidth={2.5} />
              </span>
              <span className="text-[14px] font-medium text-primary">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col items-center gap-3">
        {targets.length > 1 && (
          <p className="text-[14px] text-secondary">Нужно подписаться на все каналы:</p>
        )}
        {targets.length === 0 ? (
          <Button size="lg" disabled>
            ✈ Подписаться на канал
          </Button>
        ) : (
          targets.map((channel, index) => (
            <Button
              key={channel.username}
              size="lg"
              variant={index === 0 ? "primary" : "secondary"}
              onClick={() => openChannel(channel.username)}
            >
              ✈ {targets.length > 1 ? channel.title : "Подписаться на канал"}
            </Button>
          ))
        )}
        <button
          type="button"
          onClick={handleCheck}
          disabled={check.isPending}
          className="text-[14px] font-medium text-secondary underline decoration-border underline-offset-4"
        >
          {check.isPending ? "Проверяем..." : "Уже подписан? Проверить"}
        </button>
      </div>
    </div>
  );
}
