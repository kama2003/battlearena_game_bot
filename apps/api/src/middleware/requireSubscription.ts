import type { FastifyReply, FastifyRequest } from "fastify";
import { checkSubscription } from "../modules/subscription/service";

/**
 * Blocks access to gameplay/economy endpoints for users who aren't
 * subscribed to the channel, so the subscription gate can't be bypassed by
 * calling the API directly and skipping the frontend UI.
 */
export async function requireSubscription(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Missing user" } });
  }

  const subscribed = await checkSubscription(request.user);
  if (!subscribed) {
    return reply
      .code(403)
      .send({ error: { code: "SUBSCRIPTION_REQUIRED", message: "Channel subscription required" } });
  }
}
