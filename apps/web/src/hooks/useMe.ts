import { useQuery } from "@tanstack/react-query";
import type { MeResponse } from "@battle/types";
import { api } from "../lib/apiClient";
import { useAuthStore } from "../store/authStore";

export function useMe() {
  const isAuthed = useAuthStore((s) => Boolean(s.token));
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MeResponse>("/api/me"),
    enabled: isAuthed,
  });
}
