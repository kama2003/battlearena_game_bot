import type { Api } from "grammy";
import { env } from "../config/env";
import { callAdminApi } from "./apiClient";

export interface ChannelSubscription {
  username: string;
  title: string;
  subscribed: boolean;
}

export interface SubscriptionState {
  subscribed: boolean;
  channels: ChannelSubscription[];
}

/**
 * The authoritative check lives in apps/api (GET /api/subscription/status),
 * which knows every required channel, including the ones the admin added from
 * the bot. The bot asks it rather than calling Telegram itself, so the chat
 * gate and the Mini App can never disagree. If the API is unreachable (cold
 * start, outage) it falls back to checking just the primary channel directly,
 * so the /start flow still works.
 */
export async function getSubscriptionState(api: Api, userId: number): Promise<SubscriptionState> {
  try {
    return await callAdminApi<SubscriptionState>("/api/admin/subscription/state", {
      method: "POST",
      body: { telegramId: String(userId) },
    });
  } catch (error) {
    console.error("Subscription state from the API failed, checking the primary channel only:", error);
    const subscribed = await isSubscribedToPrimary(api, userId);
    return {
      subscribed,
      channels: [
        { username: env.CHANNEL_USERNAME, title: `@${env.CHANNEL_USERNAME}`, subscribed },
      ],
    };
  }
}

export async function isSubscribed(api: Api, userId: number): Promise<boolean> {
  return (await getSubscriptionState(api, userId)).subscribed;
}

async function isSubscribedToPrimary(api: Api, userId: number): Promise<boolean> {
  try {
    const member = await api.getChatMember(`@${env.CHANNEL_USERNAME}`, userId);
    return ["creator", "administrator", "member"].includes(member.status);
  } catch {
    return false;
  }
}

/**
 * Gates every /admin action to the channel's creator only — not to its other
 * administrators, so admin rights in the channel don't double as control of
 * the prize and the season.
 */
export async function isChannelAdmin(api: Api, userId: number): Promise<boolean> {
  try {
    const member = await api.getChatMember(`@${env.CHANNEL_USERNAME}`, userId);
    return member.status === "creator";
  } catch {
    return false;
  }
}
