import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { env } from "../config/env";
import { isSubscribed } from "../lib/subscription";

export async function handleCheckSubscription(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const subscribed = await isSubscribed(ctx.api, userId);

  if (subscribed) {
    await ctx.answerCallbackQuery({ text: "Подписка подтверждена!" });
    await ctx.editMessageText("✅ Подписка подтверждена!", {
      reply_markup: new InlineKeyboard().webApp("🎮 Открыть BATTLE", env.MINI_APP_URL),
    });
  } else {
    await ctx.answerCallbackQuery({
      text: "Мы пока не видим твою подписку. Подпишись и попробуй снова.",
      show_alert: true,
    });
  }
}
