import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubscriptionStatusResponse } from "@battle/types";
import { api } from "../lib/apiClient";

export function useSubscriptionStatus(enabled = true) {
  return useQuery({
    queryKey: ["subscription", "status"],
    queryFn: () => api.get<SubscriptionStatusResponse>("/api/subscription/status"),
    enabled,
  });
}

export function useCheckSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SubscriptionStatusResponse>("/api/subscription/check"),
    onSuccess: (data) => {
      queryClient.setQueryData(["subscription", "status"], data);
    },
  });
}
