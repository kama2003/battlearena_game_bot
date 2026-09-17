import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

export interface TelegramWebAppUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
}

export interface ParsedInitData {
  user: TelegramWebAppUser;
  authDate: number;
  startParam?: string;
}

/**
 * Verifies Telegram Mini App `initData` per the official algorithm:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * 1. secret_key = HMAC_SHA256(key="WebAppData", data=BOT_TOKEN)
 * 2. data_check_string = all fields (except `hash`), sorted by key, joined as "key=value\n"
 * 3. computed_hash = HMAC_SHA256(key=secret_key, data=data_check_string), hex
 * 4. computed_hash must equal the `hash` field, and auth_date must be recent.
 *
 * The frontend can never be trusted to supply user_id directly — this is the
 * only source of truth for "who is this Telegram user".
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string = env.BOT_TOKEN,
  maxAgeSeconds: number = env.TELEGRAM_AUTH_MAX_AGE_SECONDS,
): ParsedInitData | null {
  if (!initData) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!safeHashEquals(computedHash, hash)) {
    return null;
  }

  const authDateRaw = params.get("auth_date");
  if (!authDateRaw) return null;
  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate)) return null;

  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds < 0 || ageSeconds > maxAgeSeconds) {
    return null;
  }

  const userRaw = params.get("user");
  if (!userRaw) return null;

  let user: TelegramWebAppUser;
  try {
    const parsed = JSON.parse(userRaw);
    if (typeof parsed?.id !== "number" || typeof parsed?.first_name !== "string") {
      return null;
    }
    user = parsed;
  } catch {
    return null;
  }

  return {
    user,
    authDate,
    startParam: params.get("start_param") ?? undefined,
  };
}

function safeHashEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
