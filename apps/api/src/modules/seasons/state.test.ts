import { describe, expect, it } from "vitest";
import { isSeasonRunning } from "./state";

const now = new Date("2026-09-21T12:00:00Z");

describe("isSeasonRunning", () => {
  it("is running while active and before its end date", () => {
    expect(isSeasonRunning({ isActive: true, endsAt: new Date("2026-09-22T00:00:00Z") }, now)).toBe(true);
  });

  it("is not running once the end date has passed, even if still flagged active", () => {
    expect(isSeasonRunning({ isActive: true, endsAt: new Date("2026-09-21T06:45:00Z") }, now)).toBe(false);
  });

  it("is not running after being ended or cancelled", () => {
    expect(isSeasonRunning({ isActive: false, endsAt: new Date("2026-09-30T00:00:00Z") }, now)).toBe(false);
  });
});
