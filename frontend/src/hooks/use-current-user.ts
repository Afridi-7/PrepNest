/**
 * Centralized current-user state.
 *
 * Every page that needs `me` previously re-defined the same `useQuery` block
 * with the same key, staleTime, and gcTime. That's harmless until two callers
 * disagree on a value (e.g. one uses 5min stale, another uses 0) and the cache
 * starts churning. This hook is the single source of truth.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient, type UserProfile } from "@/services/api";

export const ME_QUERY_KEY = ["users", "me"] as const;

export function useCurrentUser(): UseQueryResult<UserProfile> {
  return useQuery<UserProfile>({
    queryKey: ME_QUERY_KEY,
    queryFn: () => apiClient.getCurrentUser(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    // Don't retry on 401 — that just means "logged out", not a transient
    // network failure. Letting RQ retry makes logout feel slow.
    retry: (failureCount, error) => {
      const message = (error as Error)?.message ?? "";
      if (message.includes("401") || /unauthor/i.test(message)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * `true` when the user is paid Pro or an admin (admins always count as Pro
 * for feature-gating purposes). Returns `false` while loading or for
 * anonymous users — gating UI should fail closed.
 */
export function useIsPro(): boolean {
  const { data } = useCurrentUser();
  return !!data?.is_pro || !!data?.is_admin;
}
