import { prisma } from "../../lib/prisma";
import { getOrRotateCurrentSeason } from "../seasons/service";
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
 * Adds (or, with a negative amount, removes) points from a participant's
 * score in the current season. The season leaderboard — the one that decides
 * the prize — ranks by bestScore, so that's what moves; totalScore follows.
 * Neither goes below zero. Day/week boards are built from actual rounds
 * played, so an admin adjustment intentionally doesn't appear there.
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

  const season = await getOrRotateCurrentSeason();

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.seasonScore.findUnique({
      where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
    });
    const bestScore = Math.max(0, (current?.bestScore ?? 0) + points);
    const totalScore = Math.max(0, (current?.totalScore ?? 0) + points);

    return tx.seasonScore.upsert({
      where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
      create: { userId: user.id, seasonId: season.id, bestScore, totalScore, gamesPlayed: 0 },
      update: {
        bestScore,
        totalScore,
        // Only a real change moves the tie-break time; re-applying the same value shouldn't.
        ...(bestScore !== current?.bestScore && { bestScoreAt: new Date() }),
      },
    });
  });

  const higher = await prisma.seasonScore.count({
    where: {
      seasonId: season.id,
      OR: [
        { bestScore: { gt: updated.bestScore } },
        { bestScore: updated.bestScore, bestScoreAt: { lt: updated.bestScoreAt } },
      ],
    },
  });

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
