import { createServer } from "node:http";
import { Bot } from "grammy";
import { env } from "./config/env";
import { handleStart } from "./handlers/start";
import { handleCheckSubscription } from "./handlers/checkSubscription";
import {
  handleAdmin,
  handleAdminCallback,
  handleAddPoints,
  handleAdminTextInput,
  handleCancelSeason,
  handleCheckWinner,
  handleSetDays,
  handleSetPrize,
  handleStartSeason,
} from "./handlers/admin";
import { getProxyAgent } from "./lib/proxyAgent";
import { startSeasonWatcher } from "./lib/seasonWatcher";

const proxyAgent = getProxyAgent();
const bot = new Bot(env.BOT_TOKEN, {
  client: proxyAgent ? { baseFetchConfig: { agent: proxyAgent } } : undefined,
});

bot.command("start", handleStart);
bot.callbackQuery("check_subscription", handleCheckSubscription);
bot.command("admin", handleAdmin);
bot.command("setprize", handleSetPrize);
bot.command("setdays", handleSetDays);
bot.command("checkwinner", handleCheckWinner);
bot.command("cancelseason", handleCancelSeason);
bot.command("addpoints", handleAddPoints);
bot.command("startseason", handleStartSeason);
bot.callbackQuery(/^admin:/, handleAdminCallback);
// Must come after every bot.command() above — it only acts when the admin
// has a pending prompt from the /admin menu, and no-ops for anything else,
// but registration order still matters since grammY runs middleware in the
// order it's added.
bot.on("message:text", handleAdminTextInput);

bot.catch((error) => {
  console.error("Bot error:", error.message, error.error);
});

// Some hosts (e.g. Render) only offer a free tier for services that bind to
// a port and answer HTTP requests — there's no free "background worker" for
// a plain long-polling process. This lets the bot pass as one of those,
// and doubles as the endpoint an external uptime pinger hits to stop the
// host from putting an idle instance to sleep.
function startHealthCheckServer() {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });
  // In local dev, apps/api may already hold this same port (shared root
  // .env). That's harmless here — the health check only matters in
  // production — so warn and move on instead of crashing the bot.
  server.on("error", (error) => {
    console.warn(`Health-check server did not start on port ${env.PORT}:`, error.message);
  });
  server.listen(env.PORT, "0.0.0.0");
}

async function main() {
  await bot.api.setChatMenuButton({
    menu_button: { type: "web_app", text: "BATTLE", web_app: { url: env.MINI_APP_URL } },
  });

  startHealthCheckServer();
  startSeasonWatcher();

  console.log(`BATTLE bot starting as @${env.BOT_USERNAME}...`);
  await bot.start({
    onStart: () => console.log("Bot is running (long polling)."),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
