import type { FastifyInstance } from "fastify";
import { env } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { checkSubscription } from "./service";

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  // GET is a convenience alias; POST is the one the "Проверить подписку"
  // button should call since it triggers a live Telegram API call.
  app.get("/api/subscription/status", async (request) => {
    const subscribed = await checkSubscription(request.user!);
    return { subscribed, channelUsername: env.CHANNEL_USERNAME };
  });

  app.post("/api/subscription/check", async (request) => {
    const subscribed = await checkSubscription(request.user!);
    return { subscribed, channelUsername: env.CHANNEL_USERNAME };
  });
}
