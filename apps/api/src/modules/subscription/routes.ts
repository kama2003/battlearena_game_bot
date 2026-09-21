import type { FastifyInstance } from "fastify";
import { env } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { checkSubscriptionDetailed } from "./service";

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  async function statusFor(user: NonNullable<import("fastify").FastifyRequest["user"]>) {
    const state = await checkSubscriptionDetailed(user);
    return {
      subscribed: state.subscribed,
      channelUsername: env.CHANNEL_USERNAME,
      channels: state.channels,
    };
  }

  // GET is a convenience alias; POST is the one the "Проверить подписку"
  // button should call since it triggers a live Telegram API call.
  app.get("/api/subscription/status", async (request) => statusFor(request.user!));

  app.post("/api/subscription/check", async (request) => statusFor(request.user!));
}
