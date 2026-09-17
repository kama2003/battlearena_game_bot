import { Navigate, Route, Routes } from "react-router-dom";
import { AuthGate } from "./components/AuthGate";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { PlayPage } from "./pages/PlayPage";
import { ResultPage } from "./pages/ResultPage";
import { TasksPage } from "./pages/TasksPage";
import { InvitePage } from "./pages/InvitePage";
import { ChallengePage } from "./pages/ChallengePage";
import { ProfilePage } from "./pages/ProfilePage";

export function App() {
  return (
    <AuthGate>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/challenge/:id" element={<ChallengePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AppShell>
    </AuthGate>
  );
}
