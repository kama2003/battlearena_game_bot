import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { claimTask, getTasksForUser, TaskError } from "./service";

const taskKeySchema = z.enum(["SUBSCRIBE_CHANNEL", "PLAY_DAILY", "INVITE_FRIEND", "SHARE_RESULT"]);

export async function tasksRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/tasks", async (request) => {
    return getTasksForUser(request.user!.id);
  });

  app.post("/api/tasks/:key/claim", async (request, reply) => {
    const parsedKey = taskKeySchema.safeParse((request.params as { key: string }).key);
    if (!parsedKey.success) {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid task key" } });
    }

    try {
      return await claimTask(request.user!.id, parsedKey.data);
    } catch (error) {
      if (error instanceof TaskError) {
        return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });
}
