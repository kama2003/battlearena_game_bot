import { prisma } from "../../lib/prisma";
import { GAME_BALANCE } from "@battle/config";
import type { LeaderboardEntryDto, LeaderboardPeriod, LeaderboardResponse } from "@battle/types";
import { getOrRotateCurrentSeason } from "../seasons/service";
import { startOfUtcDay, endOfUtcDay, startOfUtcWeek, endOfUtcWeek } from "../../lib/dates";

interface RankedRow {
  userId: string;
  score: bigint | number;
  rank: bigint | number;
  username: string | null;
  firstName: string;
  photoUrl: string | null;
}

const PAGE_SIZE = GAME_BALANCE.leaderboardPageSize;

interface LeaderboardPage {
  entries: LeaderboardEntryDto[];
  total: number;
  current: LeaderboardEntryDto | null;
}

/**
 * Day/week leaderboards rank a user's *best single round* within the window.
 * Implemented with a SQL window function (RANK() over MAX(score) per user)
 * so it stays fast with a large GameResult table instead of pulling every
 * row into the app and sorting in JS.
 */
async function getWindowedLeaderboard(
  seasonId: string,
  range: { from: Date; to: Date },
  userId: string,
  page: number,
): Promise<LeaderboardPage> {
  const offset = (page - 1) * PAGE_SIZE;

  const rows = await prisma.$queryRaw<RankedRow[]>`
    WITH scores AS (
      SELECT "userId", MAX(score) AS score
      FROM "GameResult"
      WHERE "seasonId" = ${seasonId} AND "createdAt" >= ${range.from} AND "createdAt" < ${range.to}
      GROUP BY "userId"
    ),
    ranked AS (
      SELECT s."userId", s.score, RANK() OVER (ORDER BY s.score DESC) AS rank
      FROM scores s
    )
    SELECT r."userId", r.score, r.rank, u.username, u."firstName", u."photoUrl"
    FROM ranked r
    JOIN "User" u ON u.id = r."userId"
    ORDER BY r.rank ASC
    LIMIT ${PAGE_SIZE} OFFSET ${offset};
  `;

  const countRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT "userId"
      FROM "GameResult"
      WHERE "seasonId" = ${seasonId} AND "createdAt" >= ${range.from} AND "createdAt" < ${range.to}
      GROUP BY "userId"
    ) t;
  `;

  const currentRows = await prisma.$queryRaw<RankedRow[]>`
    WITH scores AS (
      SELECT "userId", MAX(score) AS score
      FROM "GameResult"
      WHERE "seasonId" = ${seasonId} AND "createdAt" >= ${range.from} AND "createdAt" < ${range.to}
      GROUP BY "userId"
    ),
    ranked AS (
      SELECT s."userId", s.score, RANK() OVER (ORDER BY s.score DESC) AS rank
      FROM scores s
    )
    SELECT r."userId", r.score, r.rank, u.username, u."firstName", u."photoUrl"
    FROM ranked r
    JOIN "User" u ON u.id = r."userId"
    WHERE r."userId" = ${userId};
  `;

  const toDto = (row: RankedRow): LeaderboardEntryDto => ({
    rank: Number(row.rank),
    userId: row.userId,
    username: row.username,
    firstName: row.firstName,
    photoUrl: row.photoUrl,
    score: Number(row.score),
    isCurrentUser: row.userId === userId,
  });

  return {
    entries: rows.map(toDto),
    total: Number(countRows[0]?.count ?? 0),
    current: currentRows[0] ? toDto(currentRows[0]) : null,
  };
}

/** Season leaderboard reads the pre-aggregated SeasonScore table — O(page size) at any scale. */
async function getSeasonLeaderboard(seasonId: string, userId: string, page: number) {
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, total, mine] = await Promise.all([
    prisma.seasonScore.findMany({
      where: { seasonId },
      orderBy: { bestScore: "desc" },
      skip: offset,
      take: PAGE_SIZE,
      include: { user: { select: { username: true, firstName: true, photoUrl: true } } },
    }),
    prisma.seasonScore.count({ where: { seasonId } }),
    prisma.seasonScore.findUnique({ where: { userId_seasonId: { userId, seasonId } } }),
  ]);

  const entries: LeaderboardEntryDto[] = rows.map((row, index) => ({
    rank: offset + index + 1,
    userId: row.userId,
    username: row.user.username,
    firstName: row.user.firstName,
    photoUrl: row.user.photoUrl,
    score: row.bestScore,
    isCurrentUser: row.userId === userId,
  }));

  let current: LeaderboardEntryDto | null = null;
  if (mine) {
    const higherCount = await prisma.seasonScore.count({
      where: { seasonId, bestScore: { gt: mine.bestScore } },
    });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, firstName: true, photoUrl: true },
    });
    if (user) {
      current = {
        rank: higherCount + 1,
        userId,
        username: user.username,
        firstName: user.firstName,
        photoUrl: user.photoUrl,
        score: mine.bestScore,
        isCurrentUser: true,
      };
    }
  }

  return { entries, total, current };
}

export async function getLeaderboard(
  userId: string,
  period: LeaderboardPeriod,
  page: number,
): Promise<LeaderboardResponse> {
  const season = await getOrRotateCurrentSeason();

  const result =
    period === "season"
      ? await getSeasonLeaderboard(season.id, userId, page)
      : await getWindowedLeaderboard(
          season.id,
          period === "day"
            ? { from: startOfUtcDay(), to: endOfUtcDay() }
            : { from: startOfUtcWeek(), to: endOfUtcWeek() },
          userId,
          page,
        );

  return {
    period,
    page,
    pageSize: PAGE_SIZE,
    totalEntries: result.total,
    entries: result.entries,
    currentUser: result.current,
  };
}

/** Convenience helper used by the game module right after a round finishes. */
export async function getUserDayRank(
  userId: string,
): Promise<{ rank: number | null; dayBestScore: number }> {
  const season = await getOrRotateCurrentSeason();
  const { current } = await getWindowedLeaderboard(
    season.id,
    { from: startOfUtcDay(), to: endOfUtcDay() },
    userId,
    1,
  );

  const maxScoreRows = await prisma.$queryRaw<{ maxScore: number | null }[]>`
    SELECT MAX(score)::int AS "maxScore"
    FROM "GameResult"
    WHERE "seasonId" = ${season.id} AND "createdAt" >= ${startOfUtcDay()} AND "createdAt" < ${endOfUtcDay()};
  `;

  return { rank: current?.rank ?? null, dayBestScore: maxScoreRows[0]?.maxScore ?? 0 };
}
