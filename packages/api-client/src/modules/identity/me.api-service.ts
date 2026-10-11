import type { Me, MembershipChoice } from '@takhti/contracts';
import { api } from '../../kernel/client';

export const meApi = {
  /** Who is signed in and what they may do. */
  get: (signal?: AbortSignal) => api.get<Me>('/me', { signal }),
  /** The schools the signed-in person belongs to. */
  memberships: (signal?: AbortSignal) => api.get<MembershipChoice[]>('/me/memberships', { signal }),
  /** Chooses which school to continue with. */
  switchOrg: (membershipId: string) =>
    api.post<{ membershipId: string; orgId: string; kind: string }>('/me/switch-org', {
      body: { membershipId },
    }),
};
