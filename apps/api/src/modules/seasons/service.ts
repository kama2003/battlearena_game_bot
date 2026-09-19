import type { Season } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { GAME_BALANCE } from "@battle/config";
import type { SeasonResponse } from "@battle/types";
import { sendTelegramMessage } from "../telegram/client";

export interface SeasonWinner {
  userId: string;
  telegramId: string;
  firstName: string;
  username: string | null;
  rank: number;
  score: number;
}

export interface FinalizeSeasonResult {
  finalized: boolean;
  daysRemaining?: number;
  endedSeason?: { name: string; prizeDescription: string };
  winners?: SeasonWinner[];
}

/** One prize, one winner. */
const TOP_N_WINNERS = 1;

/**
 * Season standings: highest bestScore first; on equal points, whoever
 * reached that score earlier ranks higher (userId only makes it fully
 * deterministic in the vanishing case of an identical timestamp).
 */
export async function getSeasonLeaders(seasonId: string, take: number): Promise<SeasonWinner[]> {
  const rows = await prisma.seasonScore.findMany({
    where: { seasonId },
    orderBy: [{ bestScore: "desc" }, { bestScoreAt: "asc" }, { userId: "asc" }],
    take,
    include: { user: true },
  });
  return rows.map((entry, index) => ({
    userId: entry.userId,
    telegramId: entry.user.telegramId,
    firstName: entry.user.firstName,
    username: entry.user.username,
    rank: index + 1,
    score: entry.bestScore,
  }));
}

function daysBetween(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / (24 * 60 * 60 * 1000)));
}

async function createNextSeason(afterNumber: number, startsAt: Date) {
  const endsAt = new Date(startsAt.getTime() + env.SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000);
  return prisma.season.create({
    data: {
      number: afterNumber + 1,
      name: `Сезон #${afterNumber + 1}`,
      startsAt,
      endsAt,
      prizeDescription: GAME_BALANCE.defaultPrizeDescription,
      isActive: true,
    },
  });
}

async function announceSeasonResults(
  endedSeason: { name: string; prizeDescription: string },
  winners: SeasonWinner[],
): Promise<void> {
  const winner = winners[0];
  if (!winner) return;

  const name = winner.username ? `@${winner.username}` : winner.firstName;
  const announcement = [
    `🏁 ${endedSeason.name} завершён!`,
    "",
    `🏆 Победитель: ${name} — ${winner.score} очков`,
    "",
    `🎁 Приз: ${endedSeason.prizeDescription}`,
  ].join("\n");

  try {
    await sendTelegramMessage(`@${env.CHANNEL_USERNAME}`, announcement);
  } catch (error) {
    console.error("Failed to post season results to the channel:", error);
  }

  try {
    await sendTelegramMessage(
      Number(winner.telegramId),
      `🏆 Поздравляем! Ты — победитель ${endedSeason.name} с результатом ${winner.score}!\n\n` +
        `Твой приз: ${endedSeason.prizeDescription} 🎉\nС тобой свяжутся организаторы канала.`,
    );
  } catch (error) {
    // Most likely the winner never opened a DM with the bot; the channel
    // post and the /checkwinner reply still name them.
    console.error(`Failed to notify winner ${winner.telegramId}:`, error);
  }
}

/**
 * The one place a season ever rotates. Both the ordinary "just show me the
 * current season" read path and the bot's explicit /checkwinner check funnel
 * through here, so whichever one happens to notice the season expired first
 * is the only one that computes winners and sends notifications.
 *
 * That's enforced with an optimistic-lock update (`isActive: true` in the
 * WHERE clause): if a concurrent caller already flipped it, `count` comes
 * back 0 and this caller just reads whatever season won that race instead
 * of rotating — and, critically, without re-announcing anything.
 */
async function rotateIfExpired(now: Date): Promise<{
  season: Season;
  finalized: boolean;
  endedSeason?: { name: string; prizeDescription: string };
  winners?: SeasonWinner[];
}> {
  const active = await prisma.season.findFirst({ where: { isActive: true }, orderBy: { number: "desc" } });

  if (active && active.endsAt > now) {
    return { season: active, finalized: false };
  }

  if (!active) {
    const season = await createNextSeason(0, now);
    return { season, finalized: false };
  }

  const deactivated = await prisma.season.updateMany({
    where: { id: active.id, isActive: true },
    data: { isActive: false },
  });

  if (deactivated.count === 0) {
    // Another request already rotated it between our read and this update.
    const current = await prisma.season.findFirst({ where: { isActive: true }, orderBy: { number: "desc" } });
    if (current) return { season: current, finalized: false };
    // Vanishingly unlikely: the other request hasn't created its season yet.
    // Fall through and create one ourselves rather than return nothing.
  }

  const winners = await getSeasonLeaders(active.id, TOP_N_WINNERS);

  const newSeason = await createNextSeason(active.number, now);
  const endedSeason = { name: active.name, prizeDescription: active.prizeDescription };
  await announceSeasonResults(endedSeason, winners);

  return { season: newSeason, finalized: true, endedSeason, winners };
}

/**
 * Returns the current active season, rotating to a new one (and announcing
 * results, see rotateIfExpired) if the active one has expired. Season
 * history — and every score within it — is preserved; only `isActive` and
 * the pointer to "current" change.
 */
export async function getOrRotateCurrentSeason(): Promise<Season> {
  const { season } = await rotateIfExpired(new Date());
  return season;
}

/** Used by the bot's /checkwinner command and its periodic safety-net poll. */
export async function finalizeSeasonIfExpired(): Promise<FinalizeSeasonResult> {
  const now = new Date();
  const result = await rotateIfExpired(now);

  if (!result.finalized) {
    return { finalized: false, daysRemaining: daysBetween(now.getTime(), result.season.endsAt.getTime()) };
  }
  return { finalized: true, endedSeason: result.endedSeason, winners: result.winners };
}

export interface CancelSeasonResult {
  cancelledSeasonName: string | null;
  newSeason: Season;
}

/**
 * Admin-triggered early end with no winner computation and no announcement
 * — for scrapping a season gone wrong, as opposed to /checkwinner's
 * "the season ended normally, tell everyone" path. Attempts reset
 * immediately too, since getAttemptsInfo bounds "today" by the current
 * season's startsAt (see game/service.ts) — a fresh season means a fresh
 * startsAt, so nobody stays blocked by attempts they used in the old one.
 */
export async function cancelCurrentSeason(): Promise<CancelSeasonResult> {
  const now = new Date();
  const active = await prisma.season.findFirst({ where: { isActive: true }, orderBy: { number: "desc" } });

  let baseNumber = active?.number ?? 0;
  if (active) {
    const deactivated = await prisma.season.updateMany({
      where: { id: active.id, isActive: true },
      data: { isActive: false },
    });
    if (deactivated.count === 0) {
      // Cancelled or rotated by a concurrent request already — surface
      // whatever season that left active rather than creating a duplicate.
      const current = await prisma.season.findFirst({ where: { isActive: true }, orderBy: { number: "desc" } });
      if (current) return { cancelledSeasonName: active.name, newSeason: current };
    } else {
      baseNumber = active.number;
    }
  }

  const newSeason = await createNextSeason(baseNumber, now);
  return { cancelledSeasonName: active?.name ?? null, newSeason };
}

export async function buildSeasonResponse(season: Season, userId: string): Promise<SeasonResponse> {
  const [participants, personalScore] = await Promise.all([
    prisma.seasonScore.count({ where: { seasonId: season.id } }),
    prisma.seasonScore.findUnique({
      where: { userId_seasonId: { userId, seasonId: season.id } },
    }),
  ]);

  const daysRemaining = Math.max(
    0,
    Math.floor((season.endsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );

  return {
    id: season.id,
    number: season.number,
    name: season.name,
    startsAt: season.startsAt.toISOString(),
    endsAt: season.endsAt.toISOString(),
    daysRemaining,
    prizeDescription: season.prizeDescription,
    participants,
    personalBest: personalScore?.bestScore ?? 0,
  };
}
