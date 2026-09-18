import type { Season } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { GAME_BALANCE } from "@battle/config";
import type { SeasonResponse } from "@battle/types";

/**
 * Returns the current active season, rotating to a new one automatically if
 * the active season has expired. Season history (and every score within it)
 * is preserved — only `isActive` and the pointer to "current" change.
 */
export async function getOrRotateCurrentSeason(): Promise<Season> {
  const now = new Date();
  const active = await prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { number: "desc" },
  });

  if (active && active.endsAt > now) {
    return active;
  }

  return prisma.$transaction(async (tx) => {
    if (active) {
      await tx.season.update({ where: { id: active.id }, data: { isActive: false } });
    }

    const last = await tx.season.findFirst({ orderBy: { number: "desc" } });
    const nextNumber = (last?.number ?? 0) + 1;
    const startsAt = now;
    const endsAt = new Date(
      startsAt.getTime() + env.SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );

    return tx.season.create({
      data: {
        number: nextNumber,
        name: `Сезон #${nextNumber}`,
        startsAt,
        endsAt,
        prizeDescription: GAME_BALANCE.defaultPrizeDescription,
        isActive: true,
      },
    });
  });
}

export interface SeasonWinner {
  userId: string;
  telegramId: string;
  firstName: string;
  username: string | null;
  rank: number;
  score: number;
}

export interface FinalizeSeasonResult {
  finalized: boolean;
  daysRemaining?: number;
  endedSeason?: { name: string; prizeDescription: string };
  winners?: SeasonWinner[];
}

/**
 * Called by the bot's periodic season watcher (and its manual /checkwinner
 * command) — separate from getOrRotateCurrentSeason because only this path
 * needs to compute winners before the season's data effectively becomes
 * "history". If the season hasn't ended yet, this only reports how long is
 * left and touches nothing.
 */
export async function finalizeSeasonIfExpired(topN = 3): Promise<FinalizeSeasonResult> {
  const now = new Date();
  const active = await prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { number: "desc" },
  });

  if (!active || active.endsAt > now) {
    const daysRemaining = active
      ? Math.max(0, Math.ceil((active.endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
      : 0;
    return { finalized: false, daysRemaining };
  }

  const topScores = await prisma.seasonScore.findMany({
    where: { seasonId: active.id },
    orderBy: { bestScore: "desc" },
    take: topN,
    include: { user: true },
  });

  const winners: SeasonWinner[] = topScores.map((entry, index) => ({
    userId: entry.userId,
    telegramId: entry.user.telegramId,
    firstName: entry.user.firstName,
    username: entry.user.username,
    rank: index + 1,
    score: entry.bestScore,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.season.update({ where: { id: active.id }, data: { isActive: false } });

    const nextNumber = active.number + 1;
    await tx.season.create({
      data: {
        number: nextNumber,
        name: `Сезон #${nextNumber}`,
        startsAt: now,
        endsAt: new Date(now.getTime() + env.SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000),
        prizeDescription: GAME_BALANCE.defaultPrizeDescription,
        isActive: true,
      },
    });
  });

  return {
    finalized: true,
    endedSeason: { name: active.name, prizeDescription: active.prizeDescription },
    winners,
  };
}

export async function buildSeasonResponse(season: Season, userId: string): Promise<SeasonResponse> {
  const [participants, personalScore] = await Promise.all([
    prisma.seasonScore.count({ where: { seasonId: season.id } }),
    prisma.seasonScore.findUnique({
      where: { userId_seasonId: { userId, seasonId: season.id } },
    }),
  ]);

  const daysRemaining = Math.max(
    0,
    Math.ceil((season.endsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );

  return {
    id: season.id,
    number: season.number,
    name: season.name,
    startsAt: season.startsAt.toISOString(),
    endsAt: season.endsAt.toISOString(),
    daysRemaining,
    prizeDescription: season.prizeDescription,
    participants,
    personalBest: personalScore?.bestScore ?? 0,
  };
}
