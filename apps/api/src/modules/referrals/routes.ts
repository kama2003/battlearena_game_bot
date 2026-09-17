import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { getReferralsResponse } from "./service";

export async function referralsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/referrals", async (request) => {
    return getReferralsResponse(request.user!.id, request.user!.referralCode);
  });
}
