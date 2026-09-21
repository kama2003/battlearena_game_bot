import { beforeEach, describe, expect, it, vi } from "vitest";

const count = vi.fn(async () => 2);
vi.mock("../../lib/prisma", () => ({ prisma: { seasonScore: { count } } }));

const { SEASON_RANK_ORDER, countRankedAbove } = await import("./ranking");

describe("season ranking order", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sorts by best score, then season total, then earliest, then user id", () => {
    expect(SEASON_RANK_ORDER).toEqual([
      { bestScore: "desc" },
      { totalScore: "desc" },
      { bestScoreAt: "asc" },
      { userId: "asc" },
    ]);
  });

  it("counts a higher season total as ranking above on an equal best score", async () => {
    const at = new Date("2026-09-21T10:00:00Z");
    const above = await countRankedAbove("s1", {
      userId: "u1",
      bestScore: 120,
      totalScore: 300,
      bestScoreAt: at,
    });

    expect(above).toBe(2);
    const where = (count.mock.calls[0] as unknown as [{ where: { OR: unknown[] } }])[0].where;
    expect(where.OR).toContainEqual({ bestScore: 120, totalScore: { gt: 300 } });
    expect(where.OR).toContainEqual({ bestScore: { gt: 120 } });
    expect(where.OR).toContainEqual({ bestScore: 120, totalScore: 300, bestScoreAt: { lt: at } });
  });
});
