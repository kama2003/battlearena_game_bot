import type { FastifyInstance } from "fastify";
import type { MeResponse } from "@battle/types";
import { authenticate } from "../../middleware/authenticate";
import { getProfile } from "../profile/service";

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/me", async (request): Promise<MeResponse> => {
    const profile = await getProfile(request.user!);
    return {
      user: profile.user,
      rank: profile.stats.rank,
      bestScore: profile.stats.bestScore,
    };
  });
}
