import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meApi } from '@takhti/api-client';

export const meKeys = {
  me: ['me'] as const,
  memberships: ['me', 'memberships'] as const,
};

export const meQueries = {
  me: () =>
    queryOptions({
      queryKey: meKeys.me,
      queryFn: ({ signal }) => meApi.get(signal),
      staleTime: 60_000,
    }),
  memberships: () =>
    queryOptions({
      queryKey: meKeys.memberships,
      queryFn: ({ signal }) => meApi.memberships(signal),
    }),
};

/** Who is signed in and what they may do. */
export const useMe = () => useQuery(meQueries.me());

/** The schools the signed-in person belongs to. */
export const useMemberships = () => useQuery(meQueries.memberships());

/** Chooses a school. Everything cached belonged to the previous one, so the cache is emptied. */
export function useSwitchOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => meApi.switchOrg(membershipId),
    onSuccess: () => queryClient.clear(),
  });
}
