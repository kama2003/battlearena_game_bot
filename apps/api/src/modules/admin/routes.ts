import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { AwardPointsError, awardPoints } from "./points";
import {
  cancelCurrentSeason,
  finalizeSeasonIfExpired,
  getOrRotateCurrentSeason,
  getSeasonLeaders,
} from "../seasons/service";

const updateSeasonSchema = z
  .object({
    prizeDescription: z.string().trim().min(1).max(200).optional(),
    /** Days from now until the season ends — sets an absolute new end date, not an extension. */
    days: z.number().int().positive().max(365).optional(),
  })
  .refine((data) => data.prizeDescription !== undefined || data.days !== undefined, {
    message: "Provide at least one of prizeDescription or days",
  });

const awardPointsSchema = z
  .object({
    username: z.string().trim().min(1).max(64).optional(),
    telegramId: z.string().regex(/^d+$/).optional(),
    points: z.number().int().refine((n) => n !== 0, "points must not be 0").refine((n) => Math.abs(n) <= 100000),
  })
  .refine((d) => d.username !== undefined || d.telegramId !== undefined, {
    message: "Provide username or telegramId",
  });

function seasonSummary(season: { name: string; prizeDescription: string; endsAt: Date }) {
  return {
    name: season.name,
    prizeDescription: season.prizeDescription,
    endsAt: season.endsAt.toISOString(),
    daysRemaining: Math.max(0, Math.floor((season.endsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))),
  };
}

/**
 * Not part of the public API surface the Mini App uses — only the bot calls
 * these, after checking the caller is a channel administrator itself (see
 * apps/bot/src/handlers/admin.ts). Auth here is a single shared secret
 * rather than a per-user JWT since there's no Telegram-initData flow for a
 * bot command.
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request, reply) => {
    if (request.headers["x-admin-secret"] !== env.ADMIN_API_SECRET) {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid admin secret" } });
    }
  });

  app.get("/api/admin/season", async () => {
    const season = await getOrRotateCurrentSeason();
    const leaders = await getSeasonLeaders(season.id, 3);
    return {
      ...seasonSummary(season),
      leaders: leaders.map((l) => ({
        rank: l.rank,
        firstName: l.firstName,
        username: l.username,
        score: l.score,
      })),
    };
  });

  app.patch("/api/admin/season", async (request, reply) => {
    const parsed = updateSeasonSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
    }

    const season = await getOrRotateCurrentSeason();
    const updated = await prisma.season.update({
      where: { id: season.id },
      data: {
        ...(parsed.data.prizeDescription !== undefined && {
          prizeDescription: parsed.data.prizeDescription,
        }),
        ...(parsed.data.days !== undefined && {
          endsAt: new Date(Date.now() + parsed.data.days * 24 * 60 * 60 * 1000),
        }),
      },
    });
    return seasonSummary(updated);
  });

  // Polled by the bot's season watcher, and by its /checkwinner command.
  // No-op (finalized: false) if the active season hasn't reached endsAt yet.
  app.post("/api/admin/season/finalize", async () => {
    return finalizeSeasonIfExpired();
  });

  // Ends the season immediately with no winner computation or announcement
  // — /checkwinner is for a season that ended normally, this is for
  // scrapping one early.
  app.post("/api/admin/season/cancel", async () => {
    const result = await cancelCurrentSeason();
    return {
      cancelledSeasonName: result.cancelledSeasonName,
      newSeason: seasonSummary(result.newSeason),
    };
  });

  app.post("/api/admin/points", async (request, reply) => {
    const parsed = awardPointsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
    }
    try {
      const { username, telegramId, points } = parsed.data;
      return await awardPoints({ username, telegramId }, points);
    } catch (error) {
      if (error instanceof AwardPointsError) {
        return reply
          .code(error.statusCode)
          .send({ error: { code: "AWARD_FAILED", message: error.message } });
      }
      throw error;
    }
  });
}
