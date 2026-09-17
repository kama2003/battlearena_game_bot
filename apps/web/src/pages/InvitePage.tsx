import { Check, Copy, Share2, Users } from "lucide-react";
import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  InlineError,
  PageHeader,
  Skeleton,
  StatCard,
  useToast,
} from "@battle/ui";
import { useReferrals } from "../hooks/useReferrals";
import { shareViaTelegram } from "../lib/telegram";

export function InvitePage() {
  const { data, isLoading, isError, refetch } = useReferrals();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!data) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    toast.show("Ссылка скопирована", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (!data) return;
    shareViaTelegram(
      "🎮 Присоединяйся к BATTLE — соревнуйся с подписчиками канала и выигрывай призы!",
      data.referralLink,
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <PageHeader title="Пригласить друга" subtitle="+1 попытка за каждого подтверждённого друга" />

      {isError ? (
        <InlineError onRetry={() => refetch()} />
      ) : (
        <>
          <Card padding="lg" className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent-strong">
              <Users size={24} />
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-40" />
            ) : (
              <p className="text-[20px] font-bold tracking-wide text-primary">{data?.referralCode}</p>
            )}

            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex flex-1 items-center justify-center gap-2 rounded-button-sm border border-border bg-surface-alt py-3 text-[14px] font-medium text-primary"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Скопировано" : "Копировать ссылку"}
              </button>
            </div>

            <Button size="lg" icon={<Share2 size={18} />} iconPosition="left" onClick={handleShare}>
              Поделиться приглашением
            </Button>
          </Card>

          <div className="flex gap-2">
            <StatCard value={data?.totalInvited ?? 0} label="Приглашено" />
            <StatCard value={data?.confirmedCount ?? 0} label="Подтвердили" accent />
          </div>

          <div>
            <h2 className="mb-2 text-[16px] font-semibold text-primary">Твои друзья</h2>
            <Card padding="sm" className="flex flex-col gap-1">
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}

              {!isLoading && data?.referrals.length === 0 && (
                <EmptyState
                  icon={<Users size={22} />}
                  title="Пока никого нет"
                  description="Отправь ссылку другу — и он появится здесь."
                />
              )}

              {data?.referrals.map((referral) => (
                <div key={referral.id} className="flex items-center gap-3 rounded-card-sm px-3 py-2.5">
                  <Avatar name={referral.referredFirstName} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-primary">
                    {referral.referredFirstName}
                  </span>
                  <Badge variant={referral.status === "CONFIRMED" ? "success" : "neutral"}>
                    {referral.status === "CONFIRMED" ? "Подтверждён" : "Ожидает"}
                  </Badge>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
