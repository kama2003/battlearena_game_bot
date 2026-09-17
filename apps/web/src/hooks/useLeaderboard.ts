import { useQuery } from "@tanstack/react-query";
import type { LeaderboardPeriod, LeaderboardResponse } from "@battle/types";
import { api } from "../lib/apiClient";

export function useLeaderboard(period: LeaderboardPeriod, page: number) {
  return useQuery({
    queryKey: ["leaderboard", period, page],
    queryFn: () =>
      api.get<LeaderboardResponse>("/api/leaderboard", { period, page }),
    placeholderData: (previous) => previous,
  });
}
