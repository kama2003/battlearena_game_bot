import { useQuery } from "@tanstack/react-query";
import type { ProfileResponse } from "@battle/types";
import { api } from "../lib/apiClient";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<ProfileResponse>("/api/profile"),
  });
}
