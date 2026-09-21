import type { Season } from "@prisma/client";

/**
 * A season is "running" only while it is flagged active AND hasn't reached
 * its end date. Between seasons the latest season stays in the table (so the
 * leaderboard keeps showing its final standings) but is not running — nothing
 * can be played or awarded until an admin starts the next one.
 */
export function isSeasonRunning(
  season: Pick<Season, "isActive" | "endsAt">,
  now: Date = new Date(),
): boolean {
  return season.isActive && season.endsAt > now;
}
