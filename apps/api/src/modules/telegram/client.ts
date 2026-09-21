import { env } from "../../config/env";

const TELEGRAM_API_BASE = "https://api.telegram.org";

export type ChatMemberStatus =
  | "creator"
  | "administrator"
  | "member"
  | "restricted"
  | "left"
  | "kicked";

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

interface GetChatMemberResult {
  status: ChatMemberStatus;
}

interface SendMessageResult {
  message_id: number;
}

/**
 * Thin wrapper around the Telegram Bot API. BOT_TOKEN never leaves this
 * process — the frontend has no access to it and every subscription check
 * happens server-side.
 */
async function callTelegramApi<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const url = `${TELEGRAM_API_BASE}/bot${env.BOT_TOKEN}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = (await response.json()) as TelegramApiResponse<T>;
  if (!json.ok || json.result === undefined) {
    throw new TelegramApiError(json.description ?? "Unknown Telegram API error", json.error_code);
  }
  return json.result;
}

export class TelegramApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "TelegramApiError";
  }
}

const SUBSCRIBED_STATUSES = new Set<ChatMemberStatus>(["member", "administrator", "creator"]);

/**
 * Returns whether a Telegram user is currently subscribed to CHANNEL_ID.
 * Requires the bot to be an administrator of that channel.
 */
export async function isUserSubscribedToChannel(telegramUserId: string): Promise<boolean> {
  try {
    const result = await callTelegramApi<GetChatMemberResult>("getChatMember", {
      chat_id: env.CHANNEL_ID,
      user_id: Number(telegramUserId),
    });
    return SUBSCRIBED_STATUSES.has(result.status);
  } catch (error) {
    if (error instanceof TelegramApiError && error.code === 400) {
      // "user not found" in chat -> definitely not subscribed.
      return false;
    }
    throw error;
  }
}

/**
 * Sends a Telegram message as the bot — used for season-result
 * announcements (see seasons/service.ts). `chatId` can be a numeric user id
 * for a DM, or `@channelUsername` to post in the channel.
 */
export async function sendTelegramMessage(chatId: string | number, text: string): Promise<void> {
  await callTelegramApi<SendMessageResult>("sendMessage", { chat_id: chatId, text });
}

export interface ChatInfo {
  id: number;
  type: string;
  title?: string;
  username?: string;
}

export async function getChatInfo(chatId: string | number): Promise<ChatInfo> {
  return callTelegramApi<ChatInfo>("getChat", { chat_id: chatId });
}

/** The bot's own user id — the numeric part of its token. */
export function botUserId(): number {
  return Number(env.BOT_TOKEN.split(":")[0]);
}

export async function getMemberStatus(
  chatId: string | number,
  userId: number,
): Promise<ChatMemberStatus> {
  const result = await callTelegramApi<GetChatMemberResult>("getChatMember", {
    chat_id: chatId,
    user_id: userId,
  });
  return result.status;
}

const UNUSABLE_CHANNEL_ERRORS =
  /member list is inaccessible|chat not found|bot was kicked|bot is not a member|not enough rights/i;

/**
 * Like isUserSubscribedToChannel, for the admin-added channels. If the bot
 * has since lost access to one of them (removed as admin, channel deleted),
 * that channel is skipped rather than counted as "not subscribed" — otherwise
 * one broken setting would lock every player out of the game.
 */
export async function isUserSubscribedToExtraChannel(
  chatId: string,
  telegramUserId: string,
): Promise<boolean> {
  try {
    return SUBSCRIBED_STATUSES.has(await getMemberStatus(chatId, Number(telegramUserId)));
  } catch (error) {
    if (error instanceof TelegramApiError && error.code === 400) {
      if (UNUSABLE_CHANNEL_ERRORS.test(error.message)) {
        console.error(`Skipping required channel ${chatId}: ${error.message}`);
        return true;
      }
      return false;
    }
    throw error;
  }
}
