import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { isChannelAdmin } from "../lib/subscription";
import { AdminApiError, callAdminApi } from "../lib/apiClient";
import { checkAndAnnounceSeasonEnd } from "../lib/seasonWatcher";
import { setPendingAdminInput, takePendingAdminInput } from "../lib/adminState";

interface SeasonSummary {
  name: string;
  prizeDescription: string;
  endsAt: string;
  daysRemaining: number;
}

const DAY_PRESETS = [3, 7, 14, 21, 30];

async function requireAdmin(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  if (userId && (await isChannelAdmin(ctx.api, userId))) return true;
  await ctx.reply("У тебя нет прав администратора канала.");
  return false;
}

function adminMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("💰 Изменить приз", "admin:setprize")
    .text("📅 Изменить срок", "admin:setdays")
    .row()
    .text("🏆 Проверить победителя", "admin:checkwinner")
    .row()
    .text("❌ Отменить сезон", "admin:cancelseason");
}

function daysKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  DAY_PRESETS.forEach((d, i) => {
    kb.text(`${d} дн.`, `admin:setdays:${d}`);
    if ((i + 1) % 3 === 0) kb.row();
  });
  return kb.row().text("✏️ Своё число", "admin:setdays:custom").text("Отмена", "admin:cancelinput");
}

function cancelInputKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Отмена", "admin:cancelinput");
}

function cancelSeasonConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Да, отменить", "admin:cancelseason:confirm")
    .text("Не надо", "admin:cancelinput");
}

function formatTimeLeft(endsAtIso: string): string {
  const ms = new Date(endsAtIso).getTime() - Date.now();
  if (ms <= 0) return "срок вышел";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days === 0) return hours === 0 ? "меньше часа" : `${hours} ч.`;
  return hours === 0 ? `${days} дн.` : `${days} дн. ${hours} ч.`;
}

function formatSeason(season: SeasonSummary): string {
  const endsAt = new Date(season.endsAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  return `⚙️ ${season.name}\n🎁 Приз: ${season.prizeDescription}\n⏳ Осталось: ${formatTimeLeft(season.endsAt)} (до ${endsAt})`;
}

export async function handleAdmin(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  try {
    const season = await callAdminApi<SeasonSummary>("/api/admin/season");
    await ctx.reply(formatSeason(season), { reply_markup: adminMenuKeyboard() });
  } catch (error) {
    await ctx.reply(`Не удалось получить данные сезона: ${errorMessage(error)}`);
  }
}

async function applySetPrize(ctx: Context, text: string): Promise<void> {
  try {
    const season = await callAdminApi<SeasonSummary>("/api/admin/season", {
      method: "PATCH",
      body: { prizeDescription: text },
    });
    await ctx.reply(`Готово! Приз сезона: ${season.prizeDescription}`, {
      reply_markup: adminMenuKeyboard(),
    });
  } catch (error) {
    await ctx.reply(`Не удалось обновить приз: ${errorMessage(error)}`);
  }
}

async function applySetDays(ctx: Context, days: number): Promise<void> {
  try {
    const season = await callAdminApi<SeasonSummary>("/api/admin/season", {
      method: "PATCH",
      body: { days },
    });
    const endsAt = new Date(season.endsAt).toLocaleDateString("ru-RU");
    await ctx.reply(`Готово! Сезон "${season.name}" теперь заканчивается ${endsAt}.`, {
      reply_markup: adminMenuKeyboard(),
    });
  } catch (error) {
    await ctx.reply(`Не удалось обновить срок: ${errorMessage(error)}`);
  }
}

async function applyCheckWinner(ctx: Context): Promise<void> {
  try {
    const result = await checkAndAnnounceSeasonEnd();
    if (!result.finalized) {
      const left = result.daysRemaining ? `${result.daysRemaining} дн.` : "меньше суток";
      await ctx.reply(`Сезон ещё не закончился — осталось ${left}.`, {
        reply_markup: adminMenuKeyboard(),
      });
      return;
    }
    const winnerLine = result.winners?.[0]
      ? `Победитель: ${result.winners[0].username ? "@" + result.winners[0].username : result.winners[0].firstName} (${result.winners[0].score} очков).`
      : "Участников с результатами не было.";
    await ctx.reply(
      `🏁 ${result.endedSeason?.name} завершён. ${winnerLine}\n\n` +
        `Объявление уже отправлено в канал, призёры уведомлены в личку.`,
      { reply_markup: adminMenuKeyboard() },
    );
  } catch (error) {
    await ctx.reply(`Не удалось проверить итоги сезона: ${errorMessage(error)}`);
  }
}

async function applyCancelSeason(ctx: Context): Promise<void> {
  try {
    const result = await callAdminApi<{ cancelledSeasonName: string | null; newSeason: SeasonSummary }>(
      "/api/admin/season/cancel",
      { method: "POST" },
    );
    const cancelledPart = result.cancelledSeasonName ? ` "${result.cancelledSeasonName}"` : "";
    await ctx.reply(
      `Сезон${cancelledPart} отменён без объявления победителя.\n\n` +
        `Начат новый: ${result.newSeason.name} (приз: ${result.newSeason.prizeDescription}, ` +
        `${formatTimeLeft(result.newSeason.endsAt)}).\nУ всех игроков снова доступны попытки.`,
      { reply_markup: adminMenuKeyboard() },
    );
  } catch (error) {
    await ctx.reply(`Не удалось отменить сезон: ${errorMessage(error)}`);
  }
}

// --- Slash commands — kept working for anyone who prefers typing them directly.

export async function handleSetPrize(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const text = ctx.match?.toString().trim();
  if (!text) {
    await ctx.reply("Использование: /setprize iPhone 16 Pro");
    return;
  }
  await applySetPrize(ctx, text);
}

export async function handleSetDays(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const raw = ctx.match?.toString().trim();
  const days = Number(raw);
  if (!raw || !Number.isFinite(days) || days <= 0) {
    await ctx.reply("Использование: /setdays 14");
    return;
  }
  await applySetDays(ctx, days);
}

export async function handleCheckWinner(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  await applyCheckWinner(ctx);
}

export async function handleCancelSeason(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  await applyCancelSeason(ctx);
}

// --- Inline-keyboard buttons, driven by /admin's menu — the main way this
// is meant to be used day to day, so the admin isn't retyping commands.

export async function handleAdminCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const userId = ctx.from?.id;
  if (!data?.startsWith("admin:") || !userId) return;

  if (!(await isChannelAdmin(ctx.api, userId))) {
    await ctx.answerCallbackQuery({ text: "Нет прав администратора канала.", show_alert: true });
    return;
  }

  const action = data.slice("admin:".length);
  await ctx.answerCallbackQuery();

  if (action === "setprize") {
    setPendingAdminInput(userId, "prize");
    await ctx.reply("Напиши новый приз одним сообщением (например: iPhone 16 Pro).", {
      reply_markup: cancelInputKeyboard(),
    });
    return;
  }

  if (action === "setdays") {
    await ctx.reply("На сколько дней от сегодня?", { reply_markup: daysKeyboard() });
    return;
  }

  if (action.startsWith("setdays:")) {
    const value = action.slice("setdays:".length);
    if (value === "custom") {
      setPendingAdminInput(userId, "days");
      await ctx.reply("Напиши число дней одним сообщением (например: 14).", {
        reply_markup: cancelInputKeyboard(),
      });
      return;
    }
    await applySetDays(ctx, Number(value));
    return;
  }

  if (action === "checkwinner") {
    await applyCheckWinner(ctx);
    return;
  }

  if (action === "cancelseason") {
    await ctx.reply("Точно отменить текущий сезон без объявления победителя?", {
      reply_markup: cancelSeasonConfirmKeyboard(),
    });
    return;
  }

  if (action === "cancelseason:confirm") {
    await applyCancelSeason(ctx);
    return;
  }

  if (action === "cancelinput") {
    takePendingAdminInput(userId);
    await ctx.reply("Ок, ничего не меняю.", { reply_markup: adminMenuKeyboard() });
  }
}

// --- Free-text replies for the two actions that need typed input
// (setprize's text, setdays' custom number) — only acts when this admin has
// a pending prompt from the callback handler above; a no-op otherwise, so
// it never intercepts anyone else's normal messages to the bot.

export async function handleAdminTextInput(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const pending = takePendingAdminInput(userId);
  if (!pending) return;

  const text = ctx.message?.text?.trim();
  if (!text) return;

  if (pending === "prize") {
    await applySetPrize(ctx, text);
    return;
  }

  const days = Number(text);
  if (!Number.isFinite(days) || days <= 0) {
    await ctx.reply("Это не похоже на число дней. Открой /admin и попробуй ещё раз.");
    return;
  }
  await applySetDays(ctx, days);
}

function errorMessage(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "внутренняя ошибка сервера";
}
