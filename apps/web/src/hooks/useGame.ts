import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GameAttemptsResponse,
  GameFinishResponse,
  GameStartResponse,
} from "@battle/types";
import { api } from "../lib/apiClient";

export function useAttempts() {
  return useQuery({
    queryKey: ["game", "attempts"],
    queryFn: () => api.get<GameAttemptsResponse>("/api/game/attempts"),
  });
}

export function useStartGame() {
  return useMutation({
    mutationFn: (challengeId?: string) =>
      api.post<GameStartResponse>("/api/game/start", challengeId ? { challengeId } : {}),
  });
}

export function usePlayChallenge() {
  return useMutation({
    mutationFn: (challengeId: string) =>
      api.post<GameStartResponse>(`/api/challenges/${challengeId}/play`),
  });
}

export function useFinishGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { gameSessionId: string; score: number }) =>
      api.post<GameFinishResponse>("/api/game/finish", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game", "attempts"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["season", "current"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
