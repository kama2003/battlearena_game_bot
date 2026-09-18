import type { Context } from "grammy";
import { isChannelAdmin } from "../lib/subscription";
import { AdminApiError, callAdminApi } from "../lib/apiClient";

interface SeasonSummary {
  name: string;
  prizeDescription: string;
  endsAt: string;
  daysRemaining: number;
}

async function requireAdmin(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  if (userId && (await isChannelAdmin(ctx.api, userId))) return true;
  await ctx.reply("У тебя нет прав администратора канала.");
  return false;
}

function formatSeason(season: SeasonSummary): string {
  const endsAt = new Date(season.endsAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  return (
    `⚙️ ${season.name}\n` +
    `🎁 Приз: ${season.prizeDescription}\n` +
    `⏳ Осталось: ${season.daysRemaining} дн. (до ${endsAt})\n\n` +
    `/setprize <текст> — изменить приз\n` +
    `/setdays <число> — задать срок в днях от сегодня`
  );
}

export async function handleAdmin(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  try {
    const season = await callAdminApi<SeasonSummary>("/api/admin/season");
    await ctx.reply(formatSeason(season));
  } catch (error) {
    await ctx.reply(`Не удалось получить данные сезона: ${errorMessage(error)}`);
  }
}

export async function handleSetPrize(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;

  const text = ctx.match?.toString().trim();
  if (!text) {
    await ctx.reply("Использование: /setprize iPhone 16 Pro");
    return;
  }

  try {
    const season = await callAdminApi<SeasonSummary>("/api/admin/season", {
      method: "PATCH",
      body: { prizeDescription: text },
    });
    await ctx.reply(`Готово! Приз сезона: ${season.prizeDescription}`);
  } catch (error) {
    await ctx.reply(`Не удалось обновить приз: ${errorMessage(error)}`);
  }
}

export async function handleSetDays(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;

  const raw = ctx.match?.toString().trim();
  const days = Number(raw);
  if (!raw || !Number.isFinite(days) || days <= 0) {
    await ctx.reply("Использование: /setdays 14");
    return;
  }

  try {
    const season = await callAdminApi<SeasonSummary>("/api/admin/season", {
      method: "PATCH",
      body: { days },
    });
    const endsAt = new Date(season.endsAt).toLocaleDateString("ru-RU");
    await ctx.reply(`Готово! Сезон "${season.name}" теперь заканчивается ${endsAt}.`);
  } catch (error) {
    await ctx.reply(`Не удалось обновить срок: ${errorMessage(error)}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "внутренняя ошибка сервера";
}
