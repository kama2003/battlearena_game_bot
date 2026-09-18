import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env, isProduction } from "./config/env";
import { authRoutes } from "./modules/auth/routes";
import { usersRoutes } from "./modules/users/routes";
import { subscriptionRoutes } from "./modules/subscription/routes";
import { gameRoutes } from "./modules/game/routes";
import { leaderboardRoutes } from "./modules/leaderboard/routes";
import { seasonsRoutes } from "./modules/seasons/routes";
import { referralsRoutes } from "./modules/referrals/routes";
import { challengesRoutes } from "./modules/challenges/routes";
import { tasksRoutes } from "./modules/tasks/routes";
import { profileRoutes } from "./modules/profile/routes";
import { adminRoutes } from "./modules/admin/routes";

export async function buildApp() {
  const app = Fastify({
    logger: isProduction
      ? true
      : { transport: { target: "pino-pretty", options: { colorize: true } } },
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  // The browser's Origin header is scheme+host only, never a path — but
  // MINI_APP_URL includes one (e.g. https://x.github.io/repo/, for the
  // bot's web_app button). Comparing the full URL against Origin would
  // never match, silently failing every cross-origin request as a CORS
  // error rather than a clear one.
  const miniAppOrigin = new URL(env.MINI_APP_URL).origin;
  await app.register(cors, {
    origin: [miniAppOrigin, "http://localhost:5173"],
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(subscriptionRoutes);
  await app.register(gameRoutes);
  await app.register(leaderboardRoutes);
  await app.register(seasonsRoutes);
  await app.register(referralsRoutes);
  await app.register(challengesRoutes);
  await app.register(tasksRoutes);
  await app.register(profileRoutes);
  await app.register(adminRoutes);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      error: {
        code: statusCode === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
        message: statusCode === 500 ? "Something went wrong" : error.message,
      },
    });
  });

  return app;
}
