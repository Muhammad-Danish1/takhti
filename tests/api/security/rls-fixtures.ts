import { randomUUID } from 'node:crypto';
import type { FixtureOverrides } from '../../helpers/rls';
import { generatedFixtures } from './rls-fixtures.generated';

/*
 * The generated security tests build a valid row for any table from its columns alone.
 * Where a check constraint needs a particular value, the value comes from one of two places:
 *   - `rls-fixtures.generated.ts`, written by `pnpm scaffold` for the constraints it wrote itself;
 *   - the list below, for the tables of Wave 0, which are written by hand.
 * Keys are column names as written in the table file.
 */
const handWritten: FixtureOverrides = {
  // "exactly one person id, matching the kind"
  memberships: () => ({ kind: 'staff', staffId: randomUUID() }),
  // "an email or a phone"
  invitations: () => ({ email: 'invitee@example.com' }),
  // "a reason of at least ten characters"
  support_sessions: () => ({ reason: 'Looking into a reported voucher problem' }),
  // "ends after it starts"
  platform_announcements: () => ({
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-02-01T00:00:00Z',
  }),
  // "a rejection carries a note"
  approval_steps: () => ({ note: 'Checked against the policy' }),
};

export const fixtureOverrides: FixtureOverrides = { ...generatedFixtures, ...handWritten };
