import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { isUserSubscribedToChannel, isUserSubscribedToExtraChannel } from "../telegram/client";
import { listRequiredChannels } from "../channels/service";
import { confirmReferralIfEligible } from "../referrals/service";
import type { User } from "@prisma/client";

export interface ChannelSubscription {
  username: string;
  title: string;
  subscribed: boolean;
}

export interface SubscriptionState {
  /** True only when the user is subscribed to every required channel. */
  subscribed: boolean;
  /** The primary channel first, then any the admin added. */
  channels: ChannelSubscription[];
}

/** Live check against every required channel; touches nothing in the database. */
export async function getSubscriptionState(telegramUserId: string): Promise<SubscriptionState> {
  const extras = await listRequiredChannels();
  const [primary, extraResults] = await Promise.all([
    isUserSubscribedToChannel(telegramUserId),
    Promise.all(extras.map((c) => isUserSubscribedToExtraChannel(c.chatId, telegramUserId))),
  ]);

  const channels: ChannelSubscription[] = [
    { username: env.CHANNEL_USERNAME, title: `@${env.CHANNEL_USERNAME}`, subscribed: primary },
    ...extras.map((c, i) => ({
      username: c.username,
      title: c.title,
      subscribed: extraResults[i] ?? false,
    })),
  ];
  return { subscribed: channels.every((c) => c.subscribed), channels };
}

/**
 * Checks live subscription status via the Telegram Bot API and records the
 * check for audit purposes. This is the only source of truth — the frontend
 * never decides on its own whether a user has access.
 */
export async function checkSubscriptionDetailed(user: User): Promise<SubscriptionState> {
  const state = await getSubscriptionState(user.telegramId);

  await prisma.subscriptionCheck.create({
    data: { userId: user.id, subscribed: state.subscribed },
  });

  if (state.subscribed) {
    await confirmReferralIfEligible(user.id);
  }

  return state;
}

export async function checkSubscription(user: User): Promise<boolean> {
  return (await checkSubscriptionDetailed(user)).subscribed;
}
