import { InlineKeyboard } from "grammy";
import type { CommandContext, Context } from "grammy";
import { env } from "../config/env";
import { isSubscribed } from "../lib/subscription";

const WELCOME_TEXT = [
  "🎮 <b>BATTLE</b>",
  "",
  "Соревнуйся с другими подписчиками",
  "и займи первое место.",
  "",
  "Чтобы начать игру, подпишись на канал.",
].join("\n");

function miniAppUrl(startParam?: string): string {
  if (!startParam) return env.MINI_APP_URL;
  const url = new URL(env.MINI_APP_URL);
  url.searchParams.set("ref", startParam);
  return url.toString();
}

function gateKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .url("✈️ Подписаться на канал", `https://t.me/${env.CHANNEL_USERNAME}`)
    .row()
    .text("✅ Проверить подписку", "check_subscription");
}

function openAppKeyboard(startParam?: string): InlineKeyboard {
  return new InlineKeyboard().webApp("🎮 Открыть BATTLE", miniAppUrl(startParam));
}

export async function handleStart(ctx: CommandContext<Context>): Promise<void> {
  const startParam = ctx.match ? String(ctx.match) : undefined;
  const userId = ctx.from?.id;

  if (!userId) return;

  const subscribed = await isSubscribed(ctx.api, userId);

  if (subscribed) {
    await ctx.reply("✅ Подписка подтверждена! Добро пожаловать в BATTLE.", {
      reply_markup: openAppKeyboard(startParam),
    });
    return;
  }

  await ctx.reply(WELCOME_TEXT, { parse_mode: "HTML", reply_markup: gateKeyboard() });
}
