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
        prizeFund: GAME_BALANCE.defaultPrizeFund,
        prizeCurrency: GAME_BALANCE.defaultPrizeCurrency,
        isActive: true,
      },
    });
  });
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
    prizeFund: season.prizeFund,
    prizeCurrency: season.prizeCurrency,
    participants,
    personalBest: personalScore?.bestScore ?? 0,
  };
}
