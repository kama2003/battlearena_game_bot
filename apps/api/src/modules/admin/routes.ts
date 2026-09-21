import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { AwardPointsError, awardPoints } from "./points";
import {
  SeasonError,
  cancelCurrentSeason,
  finalizeSeasonIfExpired,
  getCurrentSeason,
  getSeasonLeaders,
  startNewSeason,
} from "../seasons/service";
import { isSeasonRunning } from "../seasons/state";
import {
  ChannelError,
  addRequiredChannel,
  listRequiredChannels,
  removeRequiredChannel,
} from "../channels/service";
import { getSubscriptionState } from "../subscription/service";

const updateSeasonSchema = z
  .object({
    prizeDescription: z.string().trim().min(1).max(200).optional(),
    /** Days from now until the season ends — sets an absolute new end date, not an extension. */
    days: z.number().int().positive().max(365).optional(),
  })
  .refine((data) => data.prizeDescription !== undefined || data.days !== undefined, {
    message: "Provide at least one of prizeDescription or days",
  });

const startSeasonSchema = z.object({
  prizeDescription: z.string().trim().min(1).max(200),
  days: z.number().int().positive().max(365),
});

const awardPointsSchema = z
  .object({
    username: z.string().trim().min(1).max(64).optional(),
    telegramId: z.string().regex(/^\d+$/).optional(),
    points: z
      .number()
      .int()
      .refine((n) => n !== 0, "points must not be 0")
      .refine((n) => Math.abs(n) <= 100000),
  })
  .refine((d) => d.username !== undefined || d.telegramId !== undefined, {
    message: "Provide username or telegramId",
  });

const addChannelSchema = z.object({ channel: z.string().trim().min(1).max(200) });
const removeChannelSchema = z.object({ id: z.string().min(1).max(64) });
const subscriptionStateSchema = z.object({ telegramId: z.string().regex(/^\d+$/) });

function seasonSummary(season: {
  name: string;
  prizeDescription: string;
  endsAt: Date;
  isActive: boolean;
}) {
  const running = isSeasonRunning(season);
  return {
    name: season.name,
    prizeDescription: season.prizeDescription,
    endsAt: season.endsAt.toISOString(),
    status: running ? ("running" as const) : ("ended" as const),
    daysRemaining: running
      ? Math.max(0, Math.floor((season.endsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0,
  };
}

/**
 * Not part of the public API surface the Mini App uses — only the bot calls
 * these, after checking the caller is the channel's creator itself (see
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

  // The latest season, running or not (between seasons this is the one that
  // just ended, with its final standings).
  app.get("/api/admin/season", async () => {
    const season = await getCurrentSeason();
    const leaders = await getSeasonLeaders(season.id, 3);
    return {
      ...seasonSummary(season),
      leaders: leaders.map((l) => ({
        rank: l.rank,
        firstName: l.firstName,
        username: l.username,
        score: l.score,
        totalScore: l.totalScore,
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

    const season = await getCurrentSeason();
    if (!isSeasonRunning(season)) {
      return reply.code(409).send({
        error: { code: "SEASON_NOT_RUNNING", message: "Сезон сейчас не идёт — сначала начни новый." },
      });
    }

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

  // Polled by the bot's season watcher, and by its /checkwinner command. If
  // the season's time is up this ends and announces it; otherwise it only
  // reports the state.
  app.post("/api/admin/season/finalize", async () => {
    return finalizeSeasonIfExpired();
  });

  // Ends the season immediately with no winner computation or announcement
  // — /checkwinner is for a season that ended normally, this is for
  // scrapping one early. No new season starts; that's a separate step.
  app.post("/api/admin/season/cancel", async () => {
    return cancelCurrentSeason();
  });

  // Starts the next season now with the chosen prize and length.
  app.post("/api/admin/season/start", async (request, reply) => {
    const parsed = startSeasonSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
    }
    try {
      const season = await startNewSeason(parsed.data.days, parsed.data.prizeDescription);
      return seasonSummary(season);
    } catch (error) {
      if (error instanceof SeasonError) {
        return reply
          .code(error.statusCode)
          .send({ error: { code: "SEASON_START_FAILED", message: error.message } });
      }
      throw error;
    }
  });

  // --- Required channels -------------------------------------------------

  app.get("/api/admin/channels", async () => {
    const channels = await listRequiredChannels();
    return {
      primary: { username: env.CHANNEL_USERNAME },
      channels: channels.map((c) => ({ id: c.id, username: c.username, title: c.title })),
    };
  });

  app.post("/api/admin/channels", async (request, reply) => {
    const parsed = addChannelSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
    }
    try {
      const channel = await addRequiredChannel(parsed.data.channel);
      return { id: channel.id, username: channel.username, title: channel.title };
    } catch (error) {
      if (error instanceof ChannelError) {
        return reply
          .code(error.statusCode)
          .send({ error: { code: "CHANNEL_FAILED", message: error.message } });
      }
      throw error;
    }
  });

  app.post("/api/admin/channels/remove", async (request, reply) => {
    const parsed = removeChannelSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
    }
    try {
      const channel = await removeRequiredChannel(parsed.data.id);
      return { id: channel.id, username: channel.username };
    } catch (error) {
      if (error instanceof ChannelError) {
        return reply
          .code(error.statusCode)
          .send({ error: { code: "CHANNEL_FAILED", message: error.message } });
      }
      throw error;
    }
  });

  // The bot's /start gate asks this instead of calling Telegram itself, so
  // it checks the same full list of channels the Mini App does.
  app.post("/api/admin/subscription/state", async (request, reply) => {
    const parsed = subscriptionStateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
    }
    return getSubscriptionState(parsed.data.telegramId);
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
