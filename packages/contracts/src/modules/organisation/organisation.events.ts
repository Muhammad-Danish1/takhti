import { z } from 'zod';
import { defineEvent } from '../../kernel/events';

/*
 * The events of the organisation module: docs/plan/10-modules/m02-organisation-branches.md, section 10.
 * Nobody is notified of these; other modules listen (a new branch is given its bell schedule and,
 * if asked, its fee structures) and outgoing webhooks may carry them.
 */

export const branchCreated = defineEvent({
  key: 'branch.created',
  category: 'system',
  payload: z.object({
    branchId: z.uuid(),
    code: z.string(),
    name: z.string(),
    /** R-org-11: give the new branch the group's bell schedule template. */
    copyBellSchedule: z.boolean(),
    /** R-org-11: copy the fee structures of this branch to the new one. */
    copyFeeStructuresFrom: z.uuid().nullable(),
  }),
  variables: ['name'],
  rules: [],
});

export const branchDeactivated = defineEvent({
  key: 'branch.deactivated',
  category: 'system',
  payload: z.object({ branchId: z.uuid(), code: z.string(), name: z.string() }),
  variables: ['name'],
  rules: [],
});

export const orgSettingsChanged = defineEvent({
  key: 'org.settings-changed',
  category: 'system',
  payload: z.object({
    key: z.string(),
    /** The branch whose own value changed; empty when the group's value did. */
    branchId: z.uuid().nullable(),
  }),
  variables: ['key'],
  rules: [],
});

export const organisationEvents = [branchCreated, branchDeactivated, orgSettingsChanged] as const;
