import { Prisma } from "@prisma/client";
import type { Season } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { GAME_BALANCE } from "@battle/config";
import type { SeasonResponse } from "@battle/types";
import { sendTelegramMessage } from "../telegram/client";
import { isSeasonRunning } from "./state";
import { SEASON_RANK_ORDER } from "./ranking";

export interface SeasonWinner {
  userId: string;
  telegramId: string;
  firstName: string;
  username: string | null;
  rank: number;
  score: number;
  /** Sum of the player's rounds and awards this season — the tie-break after score. */
  totalScore: number;
}

export interface FinalizeSeasonResult {
  /** "ended" means there is no running season — it is waiting for an admin to start the next one. */
  state: "running" | "ended";
  /** True only for the call that actually ended the season and announced the result. */
  finalized: boolean;
  daysRemaining?: number;
  endedSeason?: { name: string; prizeDescription: string };
  winners?: SeasonWinner[];
}

export class SeasonError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

/** One prize, one winner. */
const TOP_N_WINNERS = 1;

/**
 * Season standings in SEASON_RANK_ORDER: best score, then season total, then
 * whoever reached the score first.
 */
export async function getSeasonLeaders(seasonId: string, take: number): Promise<SeasonWinner[]> {
  const rows = await prisma.seasonScore.findMany({
    where: { seasonId },
    orderBy: SEASON_RANK_ORDER,
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
    totalScore: entry.totalScore,
  }));
}

function daysBetween(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / (24 * 60 * 60 * 1000)));
}

async function latestSeason(): Promise<Season | null> {
  return prisma.season.findFirst({ orderBy: { number: "desc" } });
}

function createSeason(number: number, startsAt: Date, days: number, prizeDescription: string) {
  return prisma.season.create({
    data: {
      number,
      name: `Сезон #${number}`,
      startsAt,
      endsAt: new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000),
      prizeDescription,
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
 * Ends the latest season if its time is up: computes the winner, announces
 * it, and marks the season inactive. It does NOT start another season —
 * between seasons nothing is playable until an admin starts the next one.
 *
 * Every read path funnels through here, so whichever request notices the
 * expiry first is the only one that announces: the isActive flip is an
 * optimistic-lock update (`isActive: true` in the WHERE), and a concurrent
 * caller that loses it just re-reads the season instead of announcing again.
 */
async function endSeasonIfExpired(now: Date): Promise<{
  season: Season;
  finalized: boolean;
  endedSeason?: { name: string; prizeDescription: string };
  winners?: SeasonWinner[];
}> {
  const latest = await latestSeason();

  if (!latest) {
    // Brand-new database: bootstrap the very first season.
    const first = await createSeason(
      1,
      now,
      env.SEASON_DURATION_DAYS,
      GAME_BALANCE.defaultPrizeDescription,
    );
    return { season: first, finalized: false };
  }

  if (!latest.isActive || latest.endsAt > now) {
    return { season: latest, finalized: false };
  }

  const flipped = await prisma.season.updateMany({
    where: { id: latest.id, isActive: true },
    data: { isActive: false },
  });
  const ended: Season = { ...latest, isActive: false };

  if (flipped.count === 0) {
    // Another request ended it between our read and this update.
    return { season: ended, finalized: false };
  }

  const winners = await getSeasonLeaders(latest.id, TOP_N_WINNERS);
  const endedSeason = { name: latest.name, prizeDescription: latest.prizeDescription };
  await announceSeasonResults(endedSeason, winners);

  return { season: ended, finalized: true, endedSeason, winners };
}

/**
 * The season everything else keys off: the latest one, running or not. If it
 * has expired it is ended (and announced) on the way — see endSeasonIfExpired.
 * Check isSeasonRunning() before letting anything be played or awarded.
 */
export async function getCurrentSeason(): Promise<Season> {
  const { season } = await endSeasonIfExpired(new Date());
  return season;
}

/** Used by the bot's /checkwinner command and its periodic safety-net poll. */
export async function finalizeSeasonIfExpired(): Promise<FinalizeSeasonResult> {
  const now = new Date();
  const result = await endSeasonIfExpired(now);

  if (isSeasonRunning(result.season, now)) {
    return {
      state: "running",
      finalized: false,
      daysRemaining: daysBetween(now.getTime(), result.season.endsAt.getTime()),
    };
  }

  // Not running: report the season that just ended (or ended earlier) and who won it.
  const winners = result.winners ?? (await getSeasonLeaders(result.season.id, TOP_N_WINNERS));
  return {
    state: "ended",
    finalized: result.finalized,
    endedSeason: { name: result.season.name, prizeDescription: result.season.prizeDescription },
    winners,
  };
}

export interface CancelSeasonResult {
  cancelledSeasonName: string | null;
}

/**
 * Admin-triggered early end with no winner computation and no announcement —
 * for scrapping a season gone wrong, as opposed to /checkwinner's "it ended
 * normally, tell everyone". Like a normal end it leaves no running season;
 * the admin starts the next one.
 */
export async function cancelCurrentSeason(): Promise<CancelSeasonResult> {
  const active = await prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { number: "desc" },
  });
  if (!active) return { cancelledSeasonName: null };

  await prisma.season.updateMany({
    where: { id: active.id, isActive: true },
    data: { isActive: false },
  });
  return { cancelledSeasonName: active.name };
}

/**
 * Starts the next season now, with the prize and length the admin chose.
 * Attempts reset with it, since the attempts window is bounded by the
 * current season's startsAt (see game/service.ts).
 */
export async function startNewSeason(days: number, prizeDescription: string): Promise<Season> {
  const now = new Date();
  const { season: latest } = await endSeasonIfExpired(now);

  if (isSeasonRunning(latest, now)) {
    throw new SeasonError("Сезон уже идёт — сначала отмени или дождись конца.", 409);
  }

  let season: Season;
  try {
    season = await createSeason(latest.number + 1, now, days, prizeDescription);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new SeasonError("Сезон уже начат.", 409);
    }
    throw error;
  }

  try {
    await sendTelegramMessage(
      `@${env.CHANNEL_USERNAME}`,
      [
        `🚀 ${season.name} начался!`,
        "",
        `🎁 Приз: ${season.prizeDescription}`,
        `⏳ Длится ${days} дн.`,
        "",
        `Играть: https://t.me/${env.BOT_USERNAME}`,
      ].join("\n"),
    );
  } catch (error) {
    console.error("Failed to announce the new season in the channel:", error);
  }

  return season;
}

export async function buildSeasonResponse(season: Season, userId: string): Promise<SeasonResponse> {
  const [participants, personalScore] = await Promise.all([
    prisma.seasonScore.count({ where: { seasonId: season.id } }),
    prisma.seasonScore.findUnique({
      where: { userId_seasonId: { userId, seasonId: season.id } },
    }),
  ]);

  const running = isSeasonRunning(season);
  const daysRemaining = running
    ? Math.max(0, Math.floor((season.endsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  return {
    id: season.id,
    number: season.number,
    name: season.name,
    startsAt: season.startsAt.toISOString(),
    endsAt: season.endsAt.toISOString(),
    status: running ? "running" : "ended",
    daysRemaining,
    prizeDescription: season.prizeDescription,
    participants,
    personalBest: personalScore?.bestScore ?? 0,
  };
}
