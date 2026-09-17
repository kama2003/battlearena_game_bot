import type { FastifyInstance } from "fastify";
import { leaderboardQuerySchema } from "@battle/types";
import { authenticate } from "../../middleware/authenticate";
import { getLeaderboard } from "./service";

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/leaderboard", async (request, reply) => {
    const parsed = leaderboardQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
    }

    return getLeaderboard(request.user!.id, parsed.data.period, parsed.data.page);
  });
}
