import type { Api } from "grammy";
import { env } from "../config/env";
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
  finalized: boolean;
  daysRemaining?: number;
  endedSeason?: { name: string; prizeDescription: string };
  winners?: SeasonWinner[];
}

const RANK_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

async function announceAndNotify(api: Api, result: FinalizeResult): Promise<void> {
  if (!result.finalized || !result.endedSeason || !result.winners?.length) return;

  const { endedSeason, winners } = result;

  const lines = winners.map((w) => {
    const name = w.username ? `@${w.username}` : w.firstName;
    return `${RANK_EMOJI[w.rank] ?? `${w.rank}.`} ${name} — ${w.score} очков`;
  });
  const announcement = [
    `🏁 ${endedSeason.name} завершён!`,
    "",
    ...lines,
    "",
    `🎁 Приз победителю: ${endedSeason.prizeDescription}`,
  ].join("\n");

  try {
    await api.sendMessage(`@${env.CHANNEL_USERNAME}`, announcement);
  } catch (error) {
    console.error("Failed to post season results to the channel:", error);
  }

  for (const winner of winners) {
    const text =
      winner.rank === 1
        ? `🏆 Поздравляем! Ты — победитель ${endedSeason.name} с результатом ${winner.score}!\n\n` +
          `Твой приз: ${endedSeason.prizeDescription} 🎉\nС тобой свяжутся организаторы канала.`
        : `${RANK_EMOJI[winner.rank] ?? ""} Поздравляем! Ты занял ${winner.rank} место в ${endedSeason.name} ` +
          `с результатом ${winner.score}. Отличная игра!`;
    try {
      await api.sendMessage(Number(winner.telegramId), text);
    } catch (error) {
      // Most likely the user never started a DM with the bot — nothing to
      // recover from, just don't let one failure block the rest.
      console.error(`Failed to notify winner ${winner.telegramId}:`, error);
    }
  }
}

/**
 * Asks apps/api whether the active season just ended; if it did, posts the
 * results to the channel and DMs the top scorers. Used both by the
 * background watcher and by the admin's manual /checkwinner command, so
 * behavior is identical either way.
 */
export async function checkAndAnnounceSeasonEnd(api: Api): Promise<FinalizeResult> {
  const result = await callAdminApi<FinalizeResult>("/api/admin/season/finalize", { method: "POST" });
  await announceAndNotify(api, result);
  return result;
}

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** Polls every 30 minutes — the season boundary itself doesn't need to be exact to the minute. */
export function startSeasonWatcher(api: Api): void {
  setInterval(() => {
    checkAndAnnounceSeasonEnd(api).catch((error) => {
      console.error("Season watcher check failed:", error);
    });
  }, CHECK_INTERVAL_MS);
}
