import { prisma } from "../../lib/prisma";
import { isUserSubscribedToChannel } from "../telegram/client";
import { confirmReferralIfEligible } from "../referrals/service";
import type { User } from "@prisma/client";

/**
 * Checks live subscription status via the Telegram Bot API and records the
 * check for audit purposes. This is the only source of truth — the frontend
 * never decides on its own whether a user has access.
 */
export async function checkSubscription(user: User): Promise<boolean> {
  const subscribed = await isUserSubscribedToChannel(user.telegramId);

  await prisma.subscriptionCheck.create({
    data: { userId: user.id, subscribed },
  });

  if (subscribed) {
    await confirmReferralIfEligible(user.id);
  }

  return subscribed;
}
