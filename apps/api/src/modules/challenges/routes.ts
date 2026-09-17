import type { FastifyInstance } from "fastify";
import { createChallengeSchema } from "@battle/types";
import { authenticate } from "../../middleware/authenticate";
import { requireSubscription } from "../../middleware/requireSubscription";
import { GameError, startGame } from "../game/service";
import { ChallengeError, createChallenge, getChallenge } from "./service";

export async function challengesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.post("/api/challenges", { preHandler: requireSubscription }, async (request, reply) => {
    const parsed = createChallengeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
    }
    return createChallenge(request.user!.id, parsed.data.score);
  });

  app.get("/api/challenges/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await getChallenge(id);
    } catch (error) {
      if (error instanceof ChallengeError) {
        return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });

  app.post(
    "/api/challenges/:id/play",
    { preHandler: requireSubscription },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return await startGame(request.user!, id);
      } catch (error) {
        if (error instanceof GameError) {
          return reply
            .code(error.statusCode)
            .send({ error: { code: error.code, message: error.message } });
        }
        throw error;
      }
    },
  );
}
