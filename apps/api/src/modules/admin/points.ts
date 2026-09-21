import { prisma } from "../../lib/prisma";
import { getCurrentSeason } from "../seasons/service";
import { isSeasonRunning } from "../seasons/state";
import { countRankedAbove } from "../seasons/ranking";
import { sendTelegramMessage } from "../telegram/client";

export class AwardPointsError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export interface AwardPointsResult {
  firstName: string;
  username: string | null;
  seasonName: string;
  bestScore: number;
  rank: number;
}

/**
 * Adds (or, with a negative amount, removes) points on a participant's score
 * in the current season. The points are kept as a separate bonus on top of
 * their best round (SeasonScore.bonusPoints), and that bonus counts on the
 * Day, Week and Season boards alike — so the number an admin sets is the
 * number everyone sees, everywhere. The resulting score never goes below zero.
 */
export async function awardPoints(
  target: { username?: string; telegramId?: string },
  points: number,
): Promise<AwardPointsResult> {
  const user = target.telegramId
    ? await prisma.user.findUnique({ where: { telegramId: target.telegramId } })
    : await prisma.user.findFirst({
        where: { username: { equals: target.username, mode: "insensitive" } },
      });

  if (!user) {
    throw new AwardPointsError(
      "Участник не найден — он должен хотя бы раз открыть приложение.",
      404,
    );
  }

  const season = await getCurrentSeason();
  if (!isSeasonRunning(season)) {
    throw new AwardPointsError("Сезон сейчас не идёт — баллы начислять некуда.", 409);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.seasonScore.findUnique({
      where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
    });
    const roundBest = current?.roundBest ?? 0;
    const bonusPoints = (current?.bonusPoints ?? 0) + points;
    const bestScore = Math.max(0, roundBest + bonusPoints);
    const totalScore = Math.max(0, (current?.totalScore ?? 0) + points);
    const now = new Date();

    return tx.seasonScore.upsert({
      where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
      create: {
        userId: user.id,
        seasonId: season.id,
        bestScore,
        roundBest,
        bonusPoints,
        bonusUpdatedAt: now,
        totalScore,
        gamesPlayed: 0,
      },
      update: {
        bestScore,
        bonusPoints,
        bonusUpdatedAt: now,
        totalScore,
        // Only a real change moves the tie-break time; re-applying the same value shouldn't.
        ...(bestScore !== current?.bestScore && { bestScoreAt: now }),
      },
    });
  });

  const higher = await countRankedAbove(season.id, updated);

  const sign = points > 0 ? "начислено" : "списано";
  try {
    await sendTelegramMessage(
      Number(user.telegramId),
      `⭐ Тебе ${sign} ${Math.abs(points)} баллов в ${season.name}. Твой счёт: ${updated.bestScore}.`,
    );
  } catch {
    // Never opened a DM with the bot — the adjustment itself already applied.
  }

  return {
    firstName: user.firstName,
    username: user.username,
    seasonName: season.name,
    bestScore: updated.bestScore,
    rank: higher + 1,
  };
}
