import { prisma } from "../../lib/prisma";
import { env, isDevelopment } from "../../config/env";
import { verifyTelegramInitData, type ParsedInitData } from "../../lib/telegramAuth";
import { generateUniqueReferralCode } from "../../lib/referralCode";
import { createPendingReferral } from "../referrals/service";
import { signSessionToken } from "../../lib/jwt";
import type { TelegramAuthResponse, UserDto } from "@battle/types";
import type { User } from "@prisma/client";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
  }
}

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

/** Deep-links use `startapp=challenge_<id>` for duels; anything else is a referral code. */
function extractReferralCode(startParam: string | undefined): string | null {
  if (!startParam || startParam.startsWith("challenge_")) return null;
  return startParam;
}

function buildDevInitData(): ParsedInitData | null {
  if (isDevelopment && env.DEV_TELEGRAM_USER_ID) {
    return {
      user: {
        id: Number(env.DEV_TELEGRAM_USER_ID),
        first_name: "Dev",
        username: "dev_user",
      },
      authDate: Math.floor(Date.now() / 1000),
    };
  }
  return null;
}

export async function authenticateWithTelegram(
  initData: string,
): Promise<TelegramAuthResponse> {
  const parsed =
    initData === "DEV_MODE" ? buildDevInitData() : verifyTelegramInitData(initData);

  if (!parsed) {
    throw new AuthError("Invalid Telegram initData");
  }

  const telegramId = String(parsed.user.id);
  const referralCode = extractReferralCode(parsed.startParam);

  const existing = await prisma.user.findUnique({ where: { telegramId } });

  let user: User;
  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: parsed.user.username ?? null,
        firstName: parsed.user.first_name,
        lastName: parsed.user.last_name ?? null,
        photoUrl: parsed.user.photo_url ?? null,
        lastSeenAt: new Date(),
      },
    });
  } else {
    let referredById: string | null = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (referrer) referredById = referrer.id;
    }

    user = await prisma.user.create({
      data: {
        telegramId,
        username: parsed.user.username ?? null,
        firstName: parsed.user.first_name,
        lastName: parsed.user.last_name ?? null,
        photoUrl: parsed.user.photo_url ?? null,
        referralCode: await generateUniqueReferralCode(),
        referredById,
      },
    });

    if (referredById) {
      await createPendingReferral(user.id, referralCode!);
    }
  }

  const token = signSessionToken({ userId: user.id, telegramId: user.telegramId });
  return { token, user: toUserDto(user) };
}
