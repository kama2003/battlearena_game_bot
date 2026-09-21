import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { env } from "../config/env";
import { getSubscriptionState } from "../lib/subscription";

export async function handleCheckSubscription(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = await getSubscriptionState(ctx.api, userId);

  if (state.subscribed) {
    await ctx.answerCallbackQuery({ text: "Подписка подтверждена!" });
    await ctx.editMessageText("✅ Подписка подтверждена!", {
      reply_markup: new InlineKeyboard().webApp("🎮 Открыть BATTLE", env.MINI_APP_URL),
    });
  } else {
    const missing = state.channels.filter((c) => !c.subscribed);
    const where = missing.length > 1 ? ` Не хватает: ${missing.map((c) => c.title).join(", ")}.` : "";
    await ctx.answerCallbackQuery({
      text: `Мы пока не видим твою подписку. Подпишись и попробуй снова.${where}`,
      show_alert: true,
    });
  }
}
