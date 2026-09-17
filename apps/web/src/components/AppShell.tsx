import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, ChartNoAxesColumn, Gamepad2, ClipboardList, User } from "lucide-react";
import { BottomNavigation } from "@battle/ui";

const NAV_ITEMS = [
  { value: "/home", label: "Главная", icon: <Home size={22} /> },
  { value: "/leaderboard", label: "Рейтинг", icon: <ChartNoAxesColumn size={22} /> },
  { value: "/play", label: "Играть", icon: <Gamepad2 size={22} /> },
  { value: "/tasks", label: "Задания", icon: <ClipboardList size={22} /> },
  { value: "/profile", label: "Профиль", icon: <User size={22} /> },
];

const IMMERSIVE_PREFIXES = ["/play", "/result", "/challenge"];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const immersive = IMMERSIVE_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));

  return (
    <div className="mx-auto min-h-[100dvh] max-w-[480px] bg-background">
      <main className={immersive ? "" : "pb-[88px]"}>{children}</main>
      {!immersive && (
        <BottomNavigation
          items={NAV_ITEMS}
          value={activeNavValue(location.pathname)}
          onChange={(value) => navigate(value)}
        />
      )}
    </div>
  );
}

function activeNavValue(pathname: string): string {
  const match = NAV_ITEMS.find((item) => pathname.startsWith(item.value));
  return match?.value ?? "/home";
}
