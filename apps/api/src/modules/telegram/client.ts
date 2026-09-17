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
