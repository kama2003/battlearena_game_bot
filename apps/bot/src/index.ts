import { Bot } from "grammy";
import { env } from "./config/env";
import { handleStart } from "./handlers/start";
import { handleCheckSubscription } from "./handlers/checkSubscription";
import { getProxyAgent } from "./lib/proxyAgent";

const proxyAgent = getProxyAgent();
const bot = new Bot(env.BOT_TOKEN, {
  client: proxyAgent ? { baseFetchConfig: { agent: proxyAgent } } : undefined,
});

bot.command("start", handleStart);
bot.callbackQuery("check_subscription", handleCheckSubscription);

bot.catch((error) => {
  console.error("Bot error:", error.message, error.error);
});

async function main() {
  await bot.api.setChatMenuButton({
    menu_button: { type: "web_app", text: "BATTLE", web_app: { url: env.MINI_APP_URL } },
  });

  console.log(`BATTLE bot starting as @${env.BOT_USERNAME}...`);
  await bot.start({
    onStart: () => console.log("Bot is running (long polling)."),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
