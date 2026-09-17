import type { FastifyInstance } from "fastify";
import { telegramAuthSchema } from "@battle/types";
import { AuthError, authenticateWithTelegram } from "./service";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/auth/telegram", async (request, reply) => {
    const parsed = telegramAuthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
    }

    try {
      const result = await authenticateWithTelegram(parsed.data.initData);
      return result;
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(401).send({ error: { code: "AUTH_FAILED", message: error.message } });
      }
      throw error;
    }
  });
}
