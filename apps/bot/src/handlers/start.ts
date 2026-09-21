import { InlineKeyboard } from "grammy";
import type { CommandContext, Context } from "grammy";
import { env } from "../config/env";
import { getSubscriptionState } from "../lib/subscription";
import type { ChannelSubscription } from "../lib/subscription";

const WELCOME_TEXT = [
  "🎮 <b>BATTLE</b>",
  "",
  "Соревнуйся с другими подписчиками",
  "и займи первое место.",
  "",
  "Чтобы начать игру, подпишись на канал.",
].join("\n");

const WELCOME_TEXT_MANY = [
  "🎮 <b>BATTLE</b>",
  "",
  "Соревнуйся с другими подписчиками",
  "и займи первое место.",
  "",
  "Чтобы начать игру, подпишись на все каналы ниже.",
].join("\n");

function miniAppUrl(startParam?: string): string {
  if (!startParam) return env.MINI_APP_URL;
  const url = new URL(env.MINI_APP_URL);
  url.searchParams.set("ref", startParam);
  return url.toString();
}

function gateKeyboard(missing: ChannelSubscription[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const channel of missing) {
    keyboard.url(`✈️ ${missing.length > 1 ? channel.title : "Подписаться на канал"}`, `https://t.me/${channel.username}`).row();
  }
  return keyboard.text("✅ Проверить подписку", "check_subscription");
}

function openAppKeyboard(startParam?: string): InlineKeyboard {
  return new InlineKeyboard().webApp("🎮 Открыть BATTLE", miniAppUrl(startParam));
}

export async function handleStart(ctx: CommandContext<Context>): Promise<void> {
  const startParam = ctx.match ? String(ctx.match) : undefined;
  const userId = ctx.from?.id;

  if (!userId) return;

  const state = await getSubscriptionState(ctx.api, userId);

  if (state.subscribed) {
    await ctx.reply("✅ Подписка подтверждена! Добро пожаловать в BATTLE.", {
      reply_markup: openAppKeyboard(startParam),
    });
    return;
  }

  const missing = state.channels.filter((c) => !c.subscribed);
  await ctx.reply(missing.length > 1 ? WELCOME_TEXT_MANY : WELCOME_TEXT, {
    parse_mode: "HTML",
    reply_markup: gateKeyboard(missing),
  });
}
