import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({ env: {} }));

const seasonScoreFindMany = vi.fn();
const seasonScoreCount = vi.fn();
const seasonScoreFindUnique = vi.fn();
const userFindUnique = vi.fn();

vi.mock("../../lib/prisma", () => ({
  prisma: {
    seasonScore: {
      findMany: seasonScoreFindMany,
      count: seasonScoreCount,
      findUnique: seasonScoreFindUnique,
    },
    user: { findUnique: userFindUnique },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("../seasons/service", () => ({
  getCurrentSeason: vi.fn(async () => ({ id: "season-1" })),
}));

const { getLeaderboard } = await import("./service");

describe("getLeaderboard (season period)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ranks entries by bestScore and marks the current user", async () => {
    seasonScoreFindMany.mockResolvedValue([
      { userId: "u1", bestScore: 300, user: { username: "maxx", firstName: "Max", photoUrl: null } },
      { userId: "u2", bestScore: 250, user: { username: "dasha", firstName: "Dasha", photoUrl: null } },
    ]);
    seasonScoreCount
      .mockResolvedValueOnce(2) // total entries in the season
      .mockResolvedValueOnce(1); // rows with a strictly higher bestScore than the current user
    seasonScoreFindUnique.mockResolvedValue({ bestScore: 250 }); // current user is "u2"
    userFindUnique.mockResolvedValue({ username: "dasha", firstName: "Dasha", photoUrl: null });

    const result = await getLeaderboard("u2", "season", 1);

    expect(result.entries[0]).toMatchObject({ rank: 1, userId: "u1", score: 300, isCurrentUser: false });
    expect(result.entries[1]).toMatchObject({ rank: 2, userId: "u2", score: 250, isCurrentUser: true });
    expect(result.currentUser).toMatchObject({ rank: 2, score: 250 });
    expect(result.totalEntries).toBe(2);
  });

  it("returns a null currentUser when the user has never played this season", async () => {
    seasonScoreFindMany.mockResolvedValue([]);
    seasonScoreCount.mockResolvedValue(0);
    seasonScoreFindUnique.mockResolvedValue(null);

    const result = await getLeaderboard("new-user", "season", 1);

    expect(result.currentUser).toBeNull();
    expect(result.entries).toHaveLength(0);
  });

  it("paginates using the page size offset", async () => {
    seasonScoreFindMany.mockResolvedValue([]);
    seasonScoreCount.mockResolvedValue(45);
    seasonScoreFindUnique.mockResolvedValue(null);

    await getLeaderboard("u1", "season", 2);

    expect(seasonScoreFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
  });
});
