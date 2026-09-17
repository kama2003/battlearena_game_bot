import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { getProfile } from "./service";

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/profile", async (request) => {
    return getProfile(request.user!);
  });
}
