import type { TelegramWebApp } from "./telegramTypes";

export function getTelegramWebApp(): TelegramWebApp | null {
  return typeof window !== "undefined" ? (window.Telegram?.WebApp ?? null) : null;
}

/** True when running inside an actual Telegram client, not a plain browser tab. */
export function isInsideTelegram(): boolean {
  const app = getTelegramWebApp();
  return Boolean(app?.initData);
}

export function initTelegramApp(): void {
  const app = getTelegramWebApp();
  if (!app) return;
  app.ready();
  app.expand();
  app.setHeaderColor("#F7F7F5");
  app.setBackgroundColor("#F7F7F5");
}

export function hapticImpact(style: "light" | "medium" | "heavy" = "light"): void {
  getTelegramWebApp()?.HapticFeedback.impactOccurred(style);
}

export function hapticNotify(type: "success" | "error" | "warning"): void {
  getTelegramWebApp()?.HapticFeedback.notificationOccurred(type);
}

export function shareViaTelegram(text: string, url: string): void {
  const app = getTelegramWebApp();
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (app) {
    app.openTelegramLink(shareUrl);
  } else {
    window.open(shareUrl, "_blank");
  }
}

export function getSafeAreaInset() {
  return getTelegramWebApp()?.safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
}
