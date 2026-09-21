import { prisma } from "../../lib/prisma";
import type { AchievementDto, ProfileResponse, UserDto } from "@battle/types";
import { getCurrentSeason } from "../seasons/service";
import type { User } from "@prisma/client";

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    referralCode: user.referralCode,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getProfile(user: User): Promise<ProfileResponse> {
  const season = await getCurrentSeason();

  const [seasonScore, gamesPlayed, duelsWon, friendsInvited] = await Promise.all([
    prisma.seasonScore.findUnique({ where: { userId_seasonId: { userId: user.id, seasonId: season.id } } }),
    prisma.gameResult.count({ where: { userId: user.id } }),
    prisma.challenge.count({ where: { opponentId: user.id, won: true } }),
    prisma.referral.count({ where: { referrerId: user.id, status: "CONFIRMED" } }),
  ]);

  const bestScore = seasonScore?.bestScore ?? 0;
  const rank = seasonScore
    ? (await prisma.seasonScore.count({
        where: { seasonId: season.id, bestScore: { gt: seasonScore.bestScore } },
      })) + 1
    : null;

  const achievements: AchievementDto[] = [
    {
      key: "FIRST_GAME",
      title: "Первый шаг",
      description: "Сыграй 1 раз",
      icon: "🔥",
      unlocked: gamesPlayed >= 1,
    },
    {
      key: "TEAM_PLAYER",
      title: "Командный игрок",
      description: "Пригласи 5 друзей",
      icon: "👥",
      unlocked: friendsInvited >= 5,
    },
    {
      key: "TOP_100",
      title: "TOP-100",
      description: "Попади в TOP-100",
      icon: "🏆",
      unlocked: rank !== null && rank <= 100,
    },
  ];

  return {
    user: toUserDto(user),
    stats: {
      bestScore,
      rank,
      gamesPlayed,
      duelsWon,
      friendsInvited,
      memberSince: user.createdAt.toISOString(),
    },
    achievements,
  };
}
