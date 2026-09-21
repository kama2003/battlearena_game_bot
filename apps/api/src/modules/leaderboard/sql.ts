import { Prisma } from "@prisma/client";

/**
 * One row per player for a day/week window: their best single round in that
 * window plus any admin bonus points on their season score.
 *
 * Bonus points count on every board, so a player who had points awarded
 * shows the same adjusted number on Day, Week and Season. A player whose
 * bonus was changed inside the window appears on that window's board even if
 * they haven't played a round in it (their round part is 0).
 */
export function windowedScoresSql(seasonId: string, range: { from: Date; to: Date }): Prisma.Sql {
  return Prisma.sql`
    SELECT p."userId", GREATEST(p.score + COALESCE(ss."bonusPoints", 0), 0) AS score
    FROM (
      SELECT "userId", MAX(score) AS score
      FROM (
        SELECT "userId", score
        FROM "GameResult"
        WHERE "seasonId" = ${seasonId} AND "createdAt" >= ${range.from} AND "createdAt" < ${range.to}
        UNION ALL
        SELECT "userId", 0 AS score
        FROM "SeasonScore"
        WHERE "seasonId" = ${seasonId}
          AND "bonusUpdatedAt" >= ${range.from} AND "bonusUpdatedAt" < ${range.to}
      ) rounds
      GROUP BY "userId"
    ) p
    LEFT JOIN "SeasonScore" ss ON ss."userId" = p."userId" AND ss."seasonId" = ${seasonId}
  `;
}
