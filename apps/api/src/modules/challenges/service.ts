import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import type { ChallengeResponse } from "@battle/types";

export class ChallengeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

function toResponse(
  challenge: {
    id: string;
    challengerId: string;
    targetScore: number;
    status: "PENDING" | "COMPLETED";
    opponentId: string | null;
    opponentScore: number | null;
    won: boolean | null;
    createdAt: Date;
  },
  challenger: { firstName: string; photoUrl: string | null },
): ChallengeResponse {
  return {
    id: challenge.id,
    challengerId: challenge.challengerId,
    challengerName: challenger.firstName,
    challengerPhotoUrl: challenger.photoUrl,
    targetScore: challenge.targetScore,
    status: challenge.status,
    opponentId: challenge.opponentId,
    opponentScore: challenge.opponentScore,
    won: challenge.won,
    shareLink: `https://t.me/${env.BOT_USERNAME}?startapp=challenge_${challenge.id}`,
    createdAt: challenge.createdAt.toISOString(),
  };
}

export async function createChallenge(userId: string, score: number): Promise<ChallengeResponse> {
  const challenger = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const challenge = await prisma.challenge.create({
    data: { challengerId: userId, targetScore: score },
  });
  return toResponse(challenge, challenger);
}

export async function getChallenge(id: string): Promise<ChallengeResponse> {
  const challenge = await prisma.challenge.findUnique({
    where: { id },
    include: { challenger: { select: { firstName: true, photoUrl: true } } },
  });
  if (!challenge) {
    throw new ChallengeError("Challenge not found", "CHALLENGE_NOT_FOUND", 404);
  }
  return toResponse(challenge, challenge.challenger);
}
