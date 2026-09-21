import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

/**
 * The season standings order, used everywhere a season rank or the winner is
 * decided so they can never disagree:
 *   1. highest best score (best round + any admin bonus);
 *   2. on a tie, the higher total for the season (sum of all rounds and awards)
 *      — a tie at the 120-point round cap is broken by who scored more overall;
 *   3. still tied: whoever reached the best score first;
 *   4. userId, only so the order is fully deterministic.
 */
export const SEASON_RANK_ORDER: Prisma.SeasonScoreOrderByWithRelationInput[] = [
  { bestScore: "desc" },
  { totalScore: "desc" },
  { bestScoreAt: "asc" },
  { userId: "asc" },
];

export interface RankKey {
  userId: string;
  bestScore: number;
  totalScore: number;
  bestScoreAt: Date;
}

/** How many players in the season are ranked strictly above this one (rank = this + 1). */
export function countRankedAbove(seasonId: string, mine: RankKey): Promise<number> {
  return prisma.seasonScore.count({
    where: {
      seasonId,
      OR: [
        { bestScore: { gt: mine.bestScore } },
        { bestScore: mine.bestScore, totalScore: { gt: mine.totalScore } },
        {
          bestScore: mine.bestScore,
          totalScore: mine.totalScore,
          bestScoreAt: { lt: mine.bestScoreAt },
        },
        {
          bestScore: mine.bestScore,
          totalScore: mine.totalScore,
          bestScoreAt: mine.bestScoreAt,
          userId: { lt: mine.userId },
        },
      ],
    },
  });
}
