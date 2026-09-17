import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
import { verifySessionToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}

/**
 * Requires a valid `Authorization: Bearer <jwt>` header issued by
 * POST /api/auth/telegram. The JWT only carries a user id — the actual user
 * row (and therefore truth about who they are) always comes from the DB.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Missing token" } });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return reply
      .code(401)
      .send({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "User not found" } });
  }

  request.user = user;
}
