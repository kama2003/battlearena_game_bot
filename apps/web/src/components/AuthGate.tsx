import { useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "../store/authStore";
import { loginWithTelegram } from "../lib/auth";
import { useSubscriptionStatus } from "../hooks/useSubscription";
import { FullScreenLoader } from "./FullScreenLoader";
import { ErrorScreen } from "./ErrorScreen";
import { SubscribePage } from "../pages/SubscribePage";

type AuthPhase = "pending" | "ready" | "error";

export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AuthPhase>("pending");
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    let cancelled = false;
    loginWithTelegram()
      .then(() => !cancelled && setPhase("ready"))
      .catch(() => !cancelled && setPhase("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  const subscription = useSubscriptionStatus(phase === "ready" && Boolean(token));

  if (phase === "pending" || (phase === "ready" && subscription.isLoading)) {
    return <FullScreenLoader />;
  }

  if (phase === "error" || subscription.isError) {
    return (
      <ErrorScreen
        title="Не удалось войти"
        description="Открой BATTLE через Telegram и попробуй снова."
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!subscription.data?.subscribed) {
    return <SubscribePage />;
  }

  return <>{children}</>;
}
