import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import type { ReferralsResponse } from "@battle/types";

/**
 * Called once, right after a brand-new user is created during Telegram auth,
 * if they arrived via a referral link. Only creates the PENDING record —
 * the reward is granted later, once the referral is actually confirmed.
 */
export async function createPendingReferral(
  referredUserId: string,
  referrerCode: string,
): Promise<void> {
  const referrer = await prisma.user.findUnique({ where: { referralCode: referrerCode } });
  if (!referrer || referrer.id === referredUserId) return;

  await prisma.referral.create({
    data: { referrerId: referrer.id, referredUserId },
  });
}

/**
 * A referral only "counts" once the referred user has confirmed their
 * channel subscription. Idempotent: the conditional `updateMany` only
 * matches (and therefore only pays out) a PENDING, not-yet-rewarded
 * referral, so concurrent subscription checks can never double-grant.
 */
export async function confirmReferralIfEligible(referredUserId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({ where: { referredUserId } });
  if (!referral || referral.status === "CONFIRMED") return;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.referral.updateMany({
      where: { id: referral.id, status: "PENDING", rewardGranted: false },
      data: { status: "CONFIRMED", rewardGranted: true, confirmedAt: new Date() },
    });

    if (updated.count === 1 && env.REFERRAL_BONUS_ATTEMPTS > 0) {
      await tx.user.update({
        where: { id: referral.referrerId },
        data: { bonusAttempts: { increment: env.REFERRAL_BONUS_ATTEMPTS } },
      });
    }
  });
}

export async function getReferralsResponse(userId: string, referralCode: string): Promise<ReferralsResponse> {
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: "desc" },
    include: { referredUser: { select: { username: true, firstName: true } } },
  });

  return {
    referralCode,
    referralLink: `https://t.me/${env.BOT_USERNAME}?startapp=${referralCode}`,
    totalInvited: referrals.length,
    confirmedCount: referrals.filter((r) => r.status === "CONFIRMED").length,
    referrals: referrals.map((r) => ({
      id: r.id,
      referredUsername: r.referredUser.username,
      referredFirstName: r.referredUser.firstName,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
