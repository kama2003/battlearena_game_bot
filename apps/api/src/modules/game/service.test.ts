import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({
  env: { DAILY_FREE_ATTEMPTS: 3, SEASON_DURATION_DAYS: 14 },
}));

const gameSessionFindUnique = vi.fn();
const gameSessionCreate = vi.fn();
const gameSessionUpdate = vi.fn();
const gameResultCount = vi.fn();
const challengeFindUnique = vi.fn();
const challengeUpdate = vi.fn();
const seasonScoreFindUnique = vi.fn();
const seasonScoreUpsert = vi.fn();
const seasonScoreUpdate = vi.fn();
const userUpdate = vi.fn();

const tx = {
  gameSession: { update: gameSessionUpdate },
  gameResult: { create: vi.fn(), count: gameResultCount },
  seasonScore: {
    upsert: seasonScoreUpsert,
    findUnique: seasonScoreFindUnique,
    update: seasonScoreUpdate,
  },
  user: { update: userUpdate },
};

vi.mock("../../lib/prisma", () => ({
  prisma: {
    gameSession: { findUnique: gameSessionFindUnique, create: gameSessionCreate, update: gameSessionUpdate },
    gameResult: { count: gameResultCount },
    challenge: { findUnique: challengeFindUnique, update: challengeUpdate },
    seasonScore: { findUnique: seasonScoreFindUnique },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(tx)),
    $queryRaw: vi.fn(async () => [{ score: null }]),
  },
}));

vi.mock("../seasons/service", () => ({
  getOrRotateCurrentSeason: vi.fn(async () => ({ id: "season-1" })),
}));

vi.mock("../leaderboard/service", () => ({
  getUserDayRank: vi.fn(async () => ({ rank: 5, dayBestScore: 100 })),
}));

const { GameError, finishGame, startGame } = await import("./service");

const baseUser = { id: "user-1", bonusAttempts: 0 } as never;

describe("startGame", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when the user has no attempts left today", async () => {
    gameResultCount.mockResolvedValue(3); // all 3 free attempts used, no bonus

    await expect(startGame(baseUser)).rejects.toThrow(GameError);
    await expect(startGame(baseUser)).rejects.toMatchObject({ code: "NO_ATTEMPTS" });
  });

  it("rejects accepting your own challenge", async () => {
    gameResultCount.mockResolvedValue(0);
    challengeFindUnique.mockResolvedValue({ id: "c1", status: "PENDING", challengerId: "user-1" });

    await expect(startGame(baseUser, "c1")).rejects.toMatchObject({ code: "CHALLENGE_SELF" });
  });

  it("rejects a challenge that is not pending", async () => {
    gameResultCount.mockResolvedValue(0);
    challengeFindUnique.mockResolvedValue({ id: "c1", status: "COMPLETED", challengerId: "someone-else" });

    await expect(startGame(baseUser, "c1")).rejects.toMatchObject({ code: "CHALLENGE_UNAVAILABLE" });
  });

  it("creates a session when attempts remain", async () => {
    gameResultCount.mockResolvedValue(1);
    gameSessionCreate.mockResolvedValue({
      id: "session-1",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await startGame(baseUser);

    expect(result.gameSessionId).toBe("session-1");
    expect(result.duration).toBe(10);
  });
});

describe("finishGame", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unknown session", async () => {
    gameSessionFindUnique.mockResolvedValue(null);
    await expect(finishGame(baseUser, "missing", 50)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND",
    });
  });

  it("rejects a session that belongs to someone else", async () => {
    gameSessionFindUnique.mockResolvedValue({ id: "s1", userId: "other-user", status: "ACTIVE" });
    await expect(finishGame(baseUser, "s1", 50)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND",
    });
  });

  it("rejects a session that was already finished (no double submission)", async () => {
    gameSessionFindUnique.mockResolvedValue({ id: "s1", userId: "user-1", status: "FINISHED" });
    await expect(finishGame(baseUser, "s1", 50)).rejects.toMatchObject({
      code: "SESSION_ALREADY_FINISHED",
    });
  });

  it("rejects a round finished implausibly fast", async () => {
    const startedAt = new Date();
    gameSessionFindUnique.mockResolvedValue({
      id: "s1",
      userId: "user-1",
      status: "ACTIVE",
      startedAt,
      expiresAt: new Date(startedAt.getTime() + 60_000),
    });

    await expect(finishGame(baseUser, "s1", 999)).rejects.toMatchObject({
      code: "ROUND_TOO_FAST",
    });
  });

  it("rejects an expired session", async () => {
    const startedAt = new Date(Date.now() - 120_000);
    gameSessionFindUnique.mockResolvedValue({
      id: "s1",
      userId: "user-1",
      status: "ACTIVE",
      startedAt,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(finishGame(baseUser, "s1", 50)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("clamps an implausibly high score to the max plausible ceiling", async () => {
    const startedAt = new Date(Date.now() - 11_000);
    gameSessionFindUnique.mockResolvedValue({
      id: "s1",
      userId: "user-1",
      status: "ACTIVE",
      startedAt,
      expiresAt: new Date(Date.now() + 50_000),
      challengeId: null,
    });
    gameResultCount.mockResolvedValue(1);
    seasonScoreFindUnique.mockResolvedValue({ bestScore: 10 });

    // 12 taps/sec * 10s = 120 max plausible; a client claiming 5000 taps must be clamped.
    const result = await finishGame(baseUser, "s1", 5000);

    expect(result.accepted).toBe(true);
    expect(result.score).toBeLessThanOrEqual(120);
  });
});
