import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { cancelCurrentSeason, finalizeSeasonIfExpired, getOrRotateCurrentSeason } from "../seasons/service";

const updateSeasonSchema = z
  .object({
    prizeDescription: z.string().trim().min(1).max(200).optional(),
    /** Days from now until the season ends — sets an absolute new end date, not an extension. */
    days: z.number().int().positive().max(365).optional(),
  })
  .refine((data) => data.prizeDescription !== undefined || data.days !== undefined, {
    message: "Provide at least one of prizeDescription or days",
  });

function seasonSummary(season: { name: string; prizeDescription: string; endsAt: Date }) {
  return {
    name: season.name,
    prizeDescription: season.prizeDescription,
    endsAt: season.endsAt.toISOString(),
    daysRemaining: Math.max(0, Math.ceil((season.endsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))),
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
    return seasonSummary(season);
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
}
