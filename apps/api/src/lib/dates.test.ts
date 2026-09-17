import { describe, expect, it } from "vitest";
import {
  dailyPeriodKey,
  endOfUtcDay,
  endOfUtcWeek,
  startOfUtcDay,
  startOfUtcWeek,
} from "./dates";

describe("date period helpers", () => {
  it("startOfUtcDay truncates to UTC midnight", () => {
    const date = new Date("2026-03-05T15:42:10.123Z");
    expect(startOfUtcDay(date).toISOString()).toBe("2026-03-05T00:00:00.000Z");
  });

  it("endOfUtcDay is exactly 24h after start", () => {
    const date = new Date("2026-03-05T15:42:10.123Z");
    const diff = endOfUtcDay(date).getTime() - startOfUtcDay(date).getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it("startOfUtcWeek resolves to the preceding Monday", () => {
    // 2026-03-05 is a Thursday.
    const thursday = new Date("2026-03-05T12:00:00.000Z");
    expect(startOfUtcWeek(thursday).toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });

  it("startOfUtcWeek on a Sunday still resolves to that week's Monday", () => {
    const sunday = new Date("2026-03-08T12:00:00.000Z");
    expect(startOfUtcWeek(sunday).toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });

  it("endOfUtcWeek is exactly 7 days after start", () => {
    const date = new Date("2026-03-05T12:00:00.000Z");
    const diff = endOfUtcWeek(date).getTime() - startOfUtcWeek(date).getTime();
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("dailyPeriodKey formats as YYYY-MM-DD", () => {
    expect(dailyPeriodKey(new Date("2026-03-05T23:59:00.000Z"))).toBe("2026-03-05");
  });
});
