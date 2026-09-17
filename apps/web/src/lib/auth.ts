import type { TelegramAuthResponse } from "@battle/types";
import { api } from "./apiClient";
import { getTelegramWebApp } from "./telegram";
import { useAuthStore } from "../store/authStore";

/**
 * Exchanges Telegram's initData for a session JWT. The raw initData string
 * is opaque to the frontend — only the backend (which holds BOT_TOKEN) can
 * verify it and decide who the user really is.
 *
 * Outside of Telegram (plain browser, local dev) there's nothing to send.
 * The backend only accepts the "DEV_MODE" sentinel when NODE_ENV !==
 * production and DEV_TELEGRAM_USER_ID is set — production always requires
 * a real, signed initData string.
 */
export async function loginWithTelegram(): Promise<void> {
  const webApp = getTelegramWebApp();
  const initData = webApp?.initData || "DEV_MODE";

  const result = await api.post<TelegramAuthResponse>("/api/auth/telegram", { initData });
  useAuthStore.getState().setSession(result.token, result.user);
}
