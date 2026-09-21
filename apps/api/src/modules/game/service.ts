import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { GAME_BALANCE } from "@battle/config";
import type { GameAttemptsResponse, GameFinishResponse, GameStartResponse } from "@battle/types";
import { startOfUtcDay, endOfUtcDay, msUntilNextUtcMidnight } from "../../lib/dates";
import { getCurrentSeason } from "../seasons/service";
import { isSeasonRunning } from "../seasons/state";
import { getUserDayRank } from "../leaderboard/service";
import { windowedScoresSql } from "../leaderboard/sql";

export class GameError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

const MAX_PLAUSIBLE_SCORE = Math.floor(
  GAME_BALANCE.maxTapsPerSecond * GAME_BALANCE.gameDurationSeconds,
);

/**
 * The free daily pool resets at UTC midnight — except a season that started
 * more recently than that (a natural rotation, or the admin cancelling one)
 * moves the window forward too, so nobody stays blocked by attempts they
 * used in the season that just ended.
 */
function attemptsWindowStart(seasonStartsAt: Date): Date {
  const dayStart = startOfUtcDay();
  return seasonStartsAt > dayStart ? seasonStartsAt : dayStart;
}

async function countFinishedInWindow(userId: string, seasonId: string, windowStart: Date): Promise<number> {
  return prisma.gameResult.count({
    where: { userId, seasonId, createdAt: { gte: windowStart, lt: endOfUtcDay() } },
  });
}

export async function getAttemptsInfo(user: User): Promise<GameAttemptsResponse> {
  const season = await getCurrentSeason();
  const finishedToday = await countFinishedInWindow(user.id, season.id, attemptsWindowStart(season.startsAt));
  const freeRemaining = Math.max(0, env.DAILY_FREE_ATTEMPTS - finishedToday);
  const remaining = freeRemaining + user.bonusAttempts;
  const total = env.DAILY_FREE_ATTEMPTS + user.bonusAttempts;

  return {
    remaining,
    total,
    nextFreeAt: remaining === 0 ? new Date(Date.now() + msUntilNextUtcMidnight()).toISOString() : null,
  };
}

/**
 * Starts a fresh, server-tracked game round. No taps or score are accepted
 * from the client until a session exists — this is what makes
 * POST /api/game/finish able to reject results that don't belong to a real,
 * time-boxed round.
 */
export async function startGame(user: User, challengeId?: string): Promise<GameStartResponse> {
  if (!isSeasonRunning(await getCurrentSeason())) {
    throw new GameError("Сезон сейчас не идёт", "SEASON_NOT_RUNNING", 403);
  }

  const { remaining } = await getAttemptsInfo(user);
  if (remaining <= 0) {
    throw new GameError("No attempts remaining today", "NO_ATTEMPTS", 403);
  }

  if (challengeId) {
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.status !== "PENDING") {
      throw new GameError("Challenge is not available", "CHALLENGE_UNAVAILABLE", 404);
    }
    if (challenge.challengerId === user.id) {
      throw new GameError("You cannot accept your own challenge", "CHALLENGE_SELF", 400);
    }
  }

  const startedAt = new Date();
  const expiresAt = new Date(
    startedAt.getTime() + GAME_BALANCE.gameSessionTtlSeconds * 1000,
  );

  const session = await prisma.gameSession.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      startedAt,
      expiresAt,
      status: "ACTIVE",
      challengeId: challengeId ?? null,
    },
  });

  const attempts = await getAttemptsInfo(user);

  return {
    gameSessionId: session.id,
    startedAt: session.startedAt.toISOString(),
    duration: GAME_BALANCE.gameDurationSeconds,
    attemptsRemaining: attempts.remaining,
  };
}

/**
 * Validates and records a round's result. The client-submitted score is
 * never trusted at face value:
 *  - the session must exist, belong to this user, be ACTIVE and unexpired
 *  - it can only be finished once (unique constraint on gameSessionId)
 *  - enough wall-clock time must actually have passed since it started
 *  - the score is clamped to what's humanly plausible for the round length
 */
export async function finishGame(
  user: User,
  gameSessionId: string,
  submittedScore: number,
): Promise<GameFinishResponse> {
  const session = await prisma.gameSession.findUnique({ where: { id: gameSessionId } });

  if (!session || session.userId !== user.id) {
    throw new GameError("Game session not found", "SESSION_NOT_FOUND", 404);
  }
  if (session.status !== "ACTIVE") {
    throw new GameError("Game session already finished", "SESSION_ALREADY_FINISHED", 409);
  }

  const now = new Date();
  const elapsedMs = now.getTime() - session.startedAt.getTime();
  const durationMs = GAME_BALANCE.gameDurationSeconds * 1000;
  const minElapsedMs = durationMs - 750; // small tolerance for network/render jitter

  if (now > session.expiresAt) {
    await prisma.gameSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
    throw new GameError("Game session expired", "SESSION_EXPIRED", 409);
  }
  if (elapsedMs < minElapsedMs) {
    throw new GameError("Round finished too early", "ROUND_TOO_FAST", 400);
  }

  const score = Math.min(submittedScore, MAX_PLAUSIBLE_SCORE);
  const season = await getCurrentSeason();
  if (!isSeasonRunning(season)) {
    // The season ended mid-round: its winner is already announced, so a late
    // result must not change the standings.
    throw new GameError("Сезон уже закончился", "SEASON_NOT_RUNNING", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.gameSession.update({
      where: { id: session.id },
      data: { status: "FINISHED", finishedAt: now },
    });

    await tx.gameResult.create({
      data: { userId: user.id, gameSessionId: session.id, score, seasonId: season.id },
    });

    await tx.seasonScore.upsert({
      where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
      create: {
        userId: user.id,
        seasonId: season.id,
        bestScore: score,
        roundBest: score,
        totalScore: score,
        gamesPlayed: 1,
      },
      update: {
        totalScore: { increment: score },
        gamesPlayed: { increment: 1 },
      },
    });

    // roundBest needs a read-then-write max(), Prisma has no atomic MAX update.
    // bestScore is roundBest plus any admin bonus, so a bonus survives later rounds.
    const current = await tx.seasonScore.findUnique({
      where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
    });
    if (current && score > current.roundBest) {
      await tx.seasonScore.update({
        where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
        data: {
          roundBest: score,
          bestScore: Math.max(0, score + current.bonusPoints),
          bestScoreAt: now,
        },
      });
    }

    // Consume a bonus attempt only once the free daily pool is exhausted. The
    // round just recorded above is included in this count, so a value greater
    // than the free allowance means this was the 4th+ attempt today.
    const finishedInWindow = await tx.gameResult.count({
      where: {
        userId: user.id,
        seasonId: season.id,
        createdAt: { gte: attemptsWindowStart(season.startsAt), lt: endOfUtcDay() },
      },
    });
    if (finishedInWindow > env.DAILY_FREE_ATTEMPTS) {
      await tx.user.update({
        where: { id: user.id },
        data: { bonusAttempts: { decrement: 1 } },
      });
    }
  });

  let challengeResult: GameFinishResponse["challenge"];
  if (session.challengeId) {
    const challenge = await prisma.challenge.findUnique({ where: { id: session.challengeId } });
    if (challenge && challenge.status === "PENDING") {
      const won = score > challenge.targetScore;
      await prisma.challenge.update({
        where: { id: challenge.id },
        data: {
          opponentId: user.id,
          opponentScore: score,
          won,
          status: "COMPLETED",
          completedAt: now,
        },
      });
      challengeResult = { won, opponentScore: challenge.targetScore };
    }
  }

  const { rank, dayBestScore } = await getUserDayRank(user.id);
  const seasonScore = await prisma.seasonScore.findUnique({
    where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
  });

  const top10Threshold = await getTop10Threshold(season.id);
  const pointsToTop10 =
    top10Threshold !== null && score < top10Threshold ? top10Threshold - score + 1 : null;

  return {
    score,
    accepted: true,
    rank,
    dayBestScore,
    totalScore: seasonScore?.totalScore ?? score,
    isTop50: rank !== null && rank <= 50,
    pointsToTop10,
    challenge: challengeResult,
  };
}

async function getTop10Threshold(seasonId: string): Promise<number | null> {
  const rows = await prisma.$queryRaw<{ score: number }[]>`
    SELECT score::int AS score
    FROM (${windowedScoresSql(seasonId, { from: startOfUtcDay(), to: endOfUtcDay() })}) s
    ORDER BY score DESC
    OFFSET 9 LIMIT 1;
  `;
  return rows[0]?.score ?? null;
}
