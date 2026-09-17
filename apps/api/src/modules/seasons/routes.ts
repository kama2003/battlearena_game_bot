import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { buildSeasonResponse, getOrRotateCurrentSeason } from "./service";

export async function seasonsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/seasons/current", async (request) => {
    const season = await getOrRotateCurrentSeason();
    return buildSeasonResponse(season, request.user!.id);
  });
}
