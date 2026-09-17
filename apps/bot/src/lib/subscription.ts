import type { Api } from "grammy";
import { env } from "../config/env";

/**
 * The bot mirrors the backend's subscription check so the chat flow (before
 * a user ever opens the Mini App) can gate access the same way. The actual
 * authoritative check the Mini App relies on happens server-side in
 * apps/api (see GET /api/subscription/status) — this is just the bot-side
 * copy of the same getChatMember call.
 */
export async function isSubscribed(api: Api, userId: number): Promise<boolean> {
  try {
    const member = await api.getChatMember(`@${env.CHANNEL_USERNAME}`, userId);
    return ["creator", "administrator", "member"].includes(member.status);
  } catch {
    return false;
  }
}
