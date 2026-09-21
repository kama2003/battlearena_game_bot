import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { isChannelAdmin } from "../lib/subscription";
import { AdminApiError, callAdminApi } from "../lib/apiClient";
import { checkAndAnnounceSeasonEnd } from "../lib/seasonWatcher";
import {
  clearAdminInput,
  setPendingAdminInput,
  setStartPrize,
  takePendingAdminInput,
  takeStartPrize,
} from "../lib/adminState";

type SeasonStatus = "running" | "ended";

interface SeasonSummary {
  name: string;
  prizeDescription: string;
  endsAt: string;
  status: SeasonStatus;
  daysRemaining: number;
  leaders?: {
    rank: number;
    firstName: string;
    username: string | null;
    score: number;
    totalScore: number;
  }[];
}

const DAY_PRESETS = [3, 7, 14, 21, 30];

async function requireAdmin(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  if (userId && (await isChannelAdmin(ctx.api, userId))) return true;
  // Stay silent for everyone else so the commands look like they don't exist.
  return false;
}

function adminMenuKeyboard(status: SeasonStatus = "running"): InlineKeyboard {
  if (status === "ended") {
    return new InlineKeyboard()
      .text("▶️ Начать новый сезон", "admin:startseason")
      .row()
      .text("🏆 Кто победил", "admin:checkwinner")
      .row()
      .text("📢 Каналы подписки", "admin:channels");
  }
  return new InlineKeyboard()
    .text("💰 Изменить приз", "admin:setprize")
    .text("📅 Изменить срок", "admin:setdays")
    .row()
    .text("⭐ Начислить баллы", "admin:points")
    .row()
    .text("🏆 Проверить победителя", "admin:checkwinner")
    .row()
    .text("📢 Каналы подписки", "admin:channels")
    .row()
    .text("❌ Отменить сезон", "admin:cancelseason");
}

interface ChannelsList {
  primary: { username: string };
  channels: { id: string; username: string; title: string }[];
}

function channelsKeyboard(list: ChannelsList): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const channel of list.channels) {
    kb.text(`🗑 Убрать @${channel.username}`, `admin:delchannel:${channel.id}`).row();
  }
  return kb.text("➕ Добавить канал", "admin:addchannel").row().text("⬅️ Меню", "admin:menu");
}

async function showChannels(ctx: Context, heading?: string): Promise<void> {
  try {
    const list = await callAdminApi<ChannelsList>("/api/admin/channels");
    const extras =
      list.channels.length > 0
        ? list.channels.map((c) => `• @${c.username} — ${c.title}`).join("\n")
        : "Дополнительных каналов пока нет.";
    await ctx.reply(
      `${heading ? `${heading}\n\n` : ""}📢 Обязательные каналы — играть можно, только подписавшись на все:\n\n` +
        `• @${list.primary.username} — основной, убрать нельзя\n${extras}`,
      { reply_markup: channelsKeyboard(list) },
    );
  } catch (error) {
    await ctx.reply(`Не удалось получить список каналов: ${errorMessage(error)}`);
  }
}

async function applyAddChannel(ctx: Context, text: string): Promise<void> {
  try {
    const channel = await callAdminApi<{ id: string; username: string; title: string }>(
      "/api/admin/channels",
      { method: "POST", body: { channel: text } },
    );
    await showChannels(ctx, `✅ @${channel.username} добавлен — теперь подписка и на него обязательна.`);
  } catch (error) {
    await ctx.reply(`Не удалось добавить канал: ${errorMessage(error)}`, {
      reply_markup: cancelInputKeyboard(),
    });
    // Let the admin fix the input and just resend, without pressing the button again.
    setPendingAdminInput(ctx.from!.id, "addchannel");
  }
}

async function applyRemoveChannel(ctx: Context, id: string): Promise<void> {
  try {
    const removed = await callAdminApi<{ username: string }>("/api/admin/channels/remove", {
      method: "POST",
      body: { id },
    });
    await showChannels(ctx, `🗑 @${removed.username} убран из обязательных.`);
  } catch (error) {
    await ctx.reply(`Не удалось убрать канал: ${errorMessage(error)}`);
  }
}

function daysKeyboard(prefix: "setdays" | "startdays"): InlineKeyboard {
  const kb = new InlineKeyboard();
  DAY_PRESETS.forEach((d, i) => {
    kb.text(`${d} дн.`, `admin:${prefix}:${d}`);
    if ((i + 1) % 3 === 0) kb.row();
  });
  return kb.row().text("✏️ Своё число", `admin:${prefix}:custom`).text("Отмена", "admin:cancelinput");
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

function leaderName(l: { username: string | null; firstName: string }): string {
  return l.username ? `@${l.username}` : l.firstName;
}

function formatLeaders(leaders: SeasonSummary["leaders"]): string {
  const [first, second] = leaders ?? [];
  if (!first) return "\n\n👑 Лидера пока нет — никто ещё не играл.";

  const tied = second !== undefined && second.score === first.score;
  const table = (leaders ?? [])
    .map((l) => {
      // Only tied players need their season total shown — it's what separates them.
      const isTied = tied && l.score === first.score;
      return `${l.rank}. ${leaderName(l)} — ${l.score}${isTied ? ` (за сезон: ${l.totalScore})` : ""}`;
    })
    .join("\n");
  const note = tied
    ? "\n⚖️ Ничья по очкам — выше тот, у кого больше очков за сезон, а при равенстве — кто набрал раньше."
    : "";
  return `\n\n👑 Побеждает сейчас: ${leaderName(first)}\n${table}${note}`;
}

function formatSeason(season: SeasonSummary): string {
  if (season.status === "ended") {
    const winner = season.leaders?.[0];
    const winnerLine = winner
      ? `🏆 Победитель: ${leaderName(winner)} — ${winner.score}`
      : "🏆 Победителя нет — никто не играл.";
    return (
      `⚙️ ${season.name} — завершён\n🎁 Приз: ${season.prizeDescription}\n${winnerLine}\n\n` +
      `Нового сезона нет, игра закрыта. Запусти его кнопкой ниже.`
    );
  }
  const endsAt = new Date(season.endsAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  return `⚙️ ${season.name}\n🎁 Приз: ${season.prizeDescription}\n⏳ Осталось: ${formatTimeLeft(season.endsAt)} (до ${endsAt})${formatLeaders(season.leaders)}`;
}

export async function handleAdmin(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  try {
    const season = await callAdminApi<SeasonSummary>("/api/admin/season");
    await ctx.reply(formatSeason(season), { reply_markup: adminMenuKeyboard(season.status) });
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
      reply_markup: adminMenuKeyboard(season.status),
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
      reply_markup: adminMenuKeyboard(season.status),
    });
  } catch (error) {
    await ctx.reply(`Не удалось обновить срок: ${errorMessage(error)}`);
  }
}

const POINTS_HINT =
  "Напиши ник и число баллов одним сообщением, например:\n@ivkama03 50\n\n" +
  "Отрицательное число спишет баллы (@ivkama03 -20). Можно и числовой Telegram ID вместо ника.";

function parsePointsInput(
  text: string,
): { username?: string; telegramId?: string; points: number } | null {
  const match = text.trim().match(/^@?(\S+)\s+([+-]?\d+)$/);
  if (!match) return null;
  const [, who, amount] = match;
  const points = Number(amount);
  if (!who || !Number.isInteger(points) || points === 0) return null;
  return /^\d+$/.test(who) ? { telegramId: who, points } : { username: who, points };
}

async function applyAwardPoints(ctx: Context, text: string): Promise<void> {
  const parsed = parsePointsInput(text);
  if (!parsed) {
    await ctx.reply(`Не понял. ${POINTS_HINT}`, { reply_markup: cancelInputKeyboard() });
    return;
  }
  try {
    const result = await callAdminApi<{
      firstName: string;
      username: string | null;
      seasonName: string;
      bestScore: number;
      rank: number;
    }>("/api/admin/points", { method: "POST", body: parsed });
    const who = result.username ? `@${result.username}` : result.firstName;
    await ctx.reply(
      `Готово! ${who}: ${parsed.points > 0 ? "+" : ""}${parsed.points} баллов в ${result.seasonName}.\n` +
        `Теперь ${result.bestScore} баллов, ${result.rank}-е место.`,
      { reply_markup: adminMenuKeyboard() },
    );
  } catch (error) {
    await ctx.reply(`Не удалось начислить баллы: ${errorMessage(error)}`, {
      reply_markup: adminMenuKeyboard(),
    });
  }
}

async function applyCheckWinner(ctx: Context): Promise<void> {
  try {
    const result = await checkAndAnnounceSeasonEnd();
    if (result.state === "running") {
      const left = result.daysRemaining ? `${result.daysRemaining} дн.` : "меньше суток";
      await ctx.reply(`Сезон ещё идёт — осталось ${left}.`, {
        reply_markup: adminMenuKeyboard("running"),
      });
      return;
    }

    const winner = result.winners?.[0];
    const winnerLine = winner
      ? `Победитель: ${leaderName(winner)} (${winner.score} очков).`
      : "Участников с результатами не было.";
    const tail = result.finalized
      ? "Объявление отправлено в канал, победителю написали в личку."
      : "Сезон уже был завершён раньше.";
    await ctx.reply(
      `🏁 ${result.endedSeason?.name} завершён. ${winnerLine}\n\n${tail}\nНового сезона нет — запусти его кнопкой ниже.`,
      { reply_markup: adminMenuKeyboard("ended") },
    );
  } catch (error) {
    await ctx.reply(`Не удалось проверить итоги сезона: ${errorMessage(error)}`);
  }
}

async function applyCancelSeason(ctx: Context): Promise<void> {
  try {
    const result = await callAdminApi<{ cancelledSeasonName: string | null }>(
      "/api/admin/season/cancel",
      { method: "POST" },
    );
    if (!result.cancelledSeasonName) {
      await ctx.reply("Сезон и так не идёт.", { reply_markup: adminMenuKeyboard("ended") });
      return;
    }
    await ctx.reply(
      `"${result.cancelledSeasonName}" отменён без объявления победителя.\n\n` +
        `Нового сезона нет, игра закрыта. Запусти его кнопкой ниже, когда будешь готов.`,
      { reply_markup: adminMenuKeyboard("ended") },
    );
  } catch (error) {
    await ctx.reply(`Не удалось отменить сезон: ${errorMessage(error)}`);
  }
}

async function applyStartSeason(ctx: Context, days: number, prizeDescription: string): Promise<void> {
  try {
    const season = await callAdminApi<SeasonSummary>("/api/admin/season/start", {
      method: "POST",
      body: { days, prizeDescription },
    });
    await ctx.reply(
      `▶️ ${season.name} начался!\n🎁 Приз: ${season.prizeDescription}\n⏳ Длится: ${formatTimeLeft(season.endsAt)}\n\n` +
        `Объявление отправлено в канал, у всех игроков свежие попытки.`,
      { reply_markup: adminMenuKeyboard("running") },
    );
  } catch (error) {
    await ctx.reply(`Не удалось начать сезон: ${errorMessage(error)}`, {
      reply_markup: adminMenuKeyboard("ended"),
    });
  }
}

async function promptStartPrize(ctx: Context, userId: number): Promise<void> {
  clearAdminInput(userId);
  setPendingAdminInput(userId, "startprize");
  await ctx.reply("Что можно выиграть в новом сезоне? Напиши приз одним сообщением (например: iPhone 16 Pro).", {
    reply_markup: cancelInputKeyboard(),
  });
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

export async function handleAddPoints(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const text = ctx.match?.toString().trim();
  if (!text) {
    await ctx.reply(`Использование: /addpoints @ник 50\n\n${POINTS_HINT}`);
    return;
  }
  await applyAwardPoints(ctx, text);
}

export async function handleCheckWinner(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  await applyCheckWinner(ctx);
}

export async function handleCancelSeason(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  await applyCancelSeason(ctx);
}

/** `/startseason 14 iPhone 16 Pro` starts straight away; bare `/startseason` walks through the questions. */
export async function handleStartSeason(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const raw = ctx.match?.toString().trim() ?? "";
  const parsed = raw.match(/^(\d+)\s+(.+)$/s);
  if (parsed) {
    await applyStartSeason(ctx, Number(parsed[1]), parsed[2]!.trim());
    return;
  }
  await promptStartPrize(ctx, ctx.from!.id);
}

// --- Inline-keyboard buttons, driven by /admin's menu — the main way this
// is meant to be used day to day, so the admin isn't retyping commands.

export async function handleAdminCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const userId = ctx.from?.id;
  if (!data?.startsWith("admin:") || !userId) return;

  if (!(await isChannelAdmin(ctx.api, userId))) {
    await ctx.answerCallbackQuery(); // no text: don't confirm the buttons do anything
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

  if (action === "points") {
    setPendingAdminInput(userId, "points");
    await ctx.reply(POINTS_HINT, { reply_markup: cancelInputKeyboard() });
    return;
  }

  if (action === "setdays") {
    await ctx.reply("На сколько дней от сегодня?", { reply_markup: daysKeyboard("setdays") });
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

  if (action === "startseason") {
    await promptStartPrize(ctx, userId);
    return;
  }

  if (action.startsWith("startdays:")) {
    const value = action.slice("startdays:".length);
    if (value === "custom") {
      setPendingAdminInput(userId, "startdays");
      await ctx.reply("Напиши число дней одним сообщением (например: 14).", {
        reply_markup: cancelInputKeyboard(),
      });
      return;
    }
    const prize = takeStartPrize(userId);
    if (!prize) {
      await ctx.reply("Приз потерялся — начни заново через /admin.");
      return;
    }
    await applyStartSeason(ctx, Number(value), prize);
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

  if (action === "channels") {
    await showChannels(ctx);
    return;
  }

  if (action === "addchannel") {
    setPendingAdminInput(userId, "addchannel");
    await ctx.reply(
      "Пришли @ник или ссылку на публичный канал (например: @mychannel).\n\n" +
        "Бот должен быть администратором этого канала — иначе он не сможет проверять подписку.",
      { reply_markup: cancelInputKeyboard() },
    );
    return;
  }

  if (action.startsWith("delchannel:")) {
    await applyRemoveChannel(ctx, action.slice("delchannel:".length));
    return;
  }

  if (action === "menu") {
    await handleAdmin(ctx);
    return;
  }

  if (action === "cancelinput") {
    clearAdminInput(userId);
    await ctx.reply("Ок, ничего не меняю. Меню — /admin.");
  }
}

// --- Free-text replies for the actions that need typed input — only acts
// when this admin has a pending prompt from the callback handler above; a
// no-op otherwise, so it never intercepts anyone else's normal messages to
// the bot.

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

  if (pending === "points") {
    await applyAwardPoints(ctx, text);
    return;
  }

  if (pending === "addchannel") {
    await applyAddChannel(ctx, text);
    return;
  }

  if (pending === "startprize") {
    setStartPrize(userId, text);
    await ctx.reply(`Приз: ${text}\n\nНа сколько дней сезон?`, { reply_markup: daysKeyboard("startdays") });
    return;
  }

  const days = Number(text);
  if (!Number.isFinite(days) || days <= 0) {
    clearAdminInput(userId);
    await ctx.reply("Это не похоже на число дней. Открой /admin и попробуй ещё раз.");
    return;
  }

  if (pending === "startdays") {
    const prize = takeStartPrize(userId);
    if (!prize) {
      await ctx.reply("Приз потерялся — начни заново через /admin.");
      return;
    }
    await applyStartSeason(ctx, days, prize);
    return;
  }

  await applySetDays(ctx, days);
}

function errorMessage(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "внутренняя ошибка сервера";
}
