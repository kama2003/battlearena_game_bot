import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { gameFinishSchema } from "@battle/types";
import { authenticate } from "../../middleware/authenticate";
import { requireSubscription } from "../../middleware/requireSubscription";
import { GameError, finishGame, getAttemptsInfo, startGame } from "./service";

const startGameSchema = z.object({ challengeId: z.string().uuid().optional() });

export async function gameRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireSubscription);

  app.post("/api/game/start", async (request, reply) => {
    const parsed = startGameSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
    }

    try {
      const result = await startGame(request.user!, parsed.data.challengeId);
      return result;
    } catch (error) {
      return handleGameError(error, reply);
    }
  });

  app.post("/api/game/finish", async (request, reply) => {
    const parsed = gameFinishSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
    }

    try {
      const result = await finishGame(request.user!, parsed.data.gameSessionId, parsed.data.score);
      return result;
    } catch (error) {
      return handleGameError(error, reply);
    }
  });

  app.get("/api/game/attempts", async (request) => {
    return getAttemptsInfo(request.user!);
  });
}

function handleGameError(error: unknown, reply: import("fastify").FastifyReply) {
  if (error instanceof GameError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}
