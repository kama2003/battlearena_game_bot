import { useQuery } from "@tanstack/react-query";
import type { ReferralsResponse } from "@battle/types";
import { api } from "../lib/apiClient";

export function useReferrals() {
  return useQuery({
    queryKey: ["referrals"],
    queryFn: () => api.get<ReferralsResponse>("/api/referrals"),
  });
}
