import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChallengeResponse } from "@battle/types";
import { api } from "../lib/apiClient";

export function useChallenge(id: string | undefined) {
  return useQuery({
    queryKey: ["challenge", id],
    queryFn: () => api.get<ChallengeResponse>(`/api/challenges/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateChallenge() {
  return useMutation({
    mutationFn: (score: number) => api.post<ChallengeResponse>("/api/challenges", { score }),
  });
}
