import { useQuery } from "@tanstack/react-query";
import type { SeasonResponse } from "@battle/types";
import { api } from "../lib/apiClient";

export function useSeason() {
  return useQuery({
    queryKey: ["season", "current"],
    queryFn: () => api.get<SeasonResponse>("/api/seasons/current"),
  });
}
