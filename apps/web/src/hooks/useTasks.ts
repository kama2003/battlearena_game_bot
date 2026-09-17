import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClaimTaskResponse, TaskKey, TasksResponse } from "@battle/types";
import { api } from "../lib/apiClient";

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.get<TasksResponse>("/api/tasks"),
  });
}

export function useClaimTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: TaskKey) => api.post<ClaimTaskResponse>(`/api/tasks/${key}/claim`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["game", "attempts"] });
    },
  });
}
