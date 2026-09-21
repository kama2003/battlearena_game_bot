import { callAdminApi } from "./apiClient";

interface SeasonWinner {
  userId: string;
  telegramId: string;
  firstName: string;
  username: string | null;
  rank: number;
  score: number;
}

export interface FinalizeResult {
  /** "ended": no running season — waiting for the admin to start the next one. */
  state: "running" | "ended";
  finalized: boolean;
  daysRemaining?: number;
  endedSeason?: { name: string; prizeDescription: string };
  winners?: SeasonWinner[];
}

/**
 * Asks apps/api whether the active season just ended. apps/api itself posts
 * the channel announcement and DMs the top scorers when it does the actual
 * rotation (see apps/api/src/modules/seasons/service.ts) — the bot's only
 * job here is to occasionally trigger the check so a rotation isn't stuck
 * waiting for the next person to open the Mini App.
 */
export async function checkAndAnnounceSeasonEnd(): Promise<FinalizeResult> {
  return callAdminApi<FinalizeResult>("/api/admin/season/finalize", { method: "POST" });
}

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** Polls every 30 minutes — the season boundary itself doesn't need to be exact to the minute. */
export function startSeasonWatcher(): void {
  setInterval(() => {
    checkAndAnnounceSeasonEnd().catch((error) => {
      console.error("Season watcher check failed:", error);
    });
  }, CHECK_INTERVAL_MS);
}
