import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registeredTables } from '@takhti/db';
import { actors, cast, sandbox, type Actor } from '../../helpers/rls';
import { createTestDb, type TestDb } from '../../helpers/test-db';

/*
 * Tables whose spec states a policy of its own, which the generated tests cannot describe.
 * Every table marked `custom` in the registry must have a section here; the first test checks that.
 */

const covered = [
  // This file.
  'files',
  'profiles',
  // custom-policies.academics.test.ts
  'question_papers',
  'paper_sections',
  'paper_questions',
  'results',
  'result_subjects',
  'report_cards',
  'co_scholastic_scores',
  // custom-policies.communication.test.ts
  'chat_threads',
  'chat_messages',
];

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.destroy();
});

const actor = (name: string): Actor => {
  const found = actors.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`No actor "${name}"`);
  return found;
};

const staff = actor('staff with every branch');
const guardian = actor('guardian of family 1');
const otherGuardian = actor('guardian of another family');
const outsider = actor('staff of another organisation');
const DENIED = '42501';

it('every table with a hand-written policy is covered here', () => {
  expect(
    registeredTables()
      .filter((table) => table.custom)
      .map((table) => table.name)
      .sort(),
  ).toEqual([...covered].sort());
});

describe('files: a member records and sees their own uploads; staff see all of the organisation', () => {
  const file = (id: string, org: string, uploadedBy: string, status = 'pending') => sql`
    insert into files (id, org_id, bucket, path, purpose, original_name, mime_type, size_bytes, status, uploaded_by)
    values (${id}::uuid, ${org}::uuid, 'private', ${`o/${id}`}, 'document', 'form.pdf', 'application/pdf', 1024, ${status}, ${uploadedBy}::uuid)`;
  const ids = {
    mine: randomUUID(),
    mineReady: randomUUID(),
    theirs: randomUUID(),
    mineElsewhere: randomUUID(),
  };
  const seed = [
    file(ids.mine, cast.orgA, cast.userSelf),
    file(ids.mineReady, cast.orgA, cast.userSelf, 'ready'),
    file(ids.theirs, cast.orgA, cast.userOther),
    file(ids.mineElsewhere, cast.orgB, cast.userSelf),
  ];
  const label = new Map<string, string>(Object.entries(ids).map(([name, id]) => [id, name]));
  const names = (rows: { id: string }[]) => rows.map((row) => label.get(row.id) ?? '?').sort();
  const all = sql`select id::text as id from files`;

  it('a guardian reads only their own uploads in the organisation they are signed in to', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      expect(names(await run<{ id: string }>(all))).toEqual(['mine', 'mineReady']);
    });
  });

  it('another guardian of the same organisation reads none of them', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(otherGuardian);
      expect(await run(all)).toEqual([]);
    });
  });

  it('a guardian may record an upload as themselves, and not as anyone else or anywhere else', async () => {
    await sandbox(async ({ as, attempt }) => {
      await as(guardian);
      expect((await attempt(file(randomUUID(), cast.orgA, cast.userSelf))).error).toBeUndefined();
      expect((await attempt(file(randomUUID(), cast.orgA, cast.userOther))).error).toBe(DENIED);
      expect((await attempt(file(randomUUID(), cast.orgB, cast.userSelf))).error).toBe(DENIED);
    });
  });

  it('a guardian may finish their own pending upload, but not touch one that is already ready', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      const changed = await attempt<{ id: string }>(
        sql`update files set checksum = 'abc' returning id::text as id`,
      );
      expect(names(changed.rows ?? [])).toEqual(['mine']);
    });
  });

  it('a guardian cannot hand their upload to someone else', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      const moved = await attempt(
        sql`update files set uploaded_by = ${cast.userOther}::uuid where id = ${ids.mine}::uuid`,
      );
      expect(moved.error).toBe(DENIED);
    });
  });

  it('a guardian cannot remove a file row', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      expect(
        (await attempt<{ id: string }>(sql`delete from files returning id::text as id`)).rows,
      ).toEqual([]);
    });
  });

  it('staff read and change every file of their organisation, and nothing of another', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      await as(staff);
      expect(names(await run<{ id: string }>(all))).toEqual(['mine', 'mineReady', 'theirs']);
      const changed = await attempt<{ id: string }>(
        sql`update files set checksum = 'abc' returning id::text as id`,
      );
      expect(names(changed.rows ?? [])).toEqual(['mine', 'mineReady', 'theirs']);
      await as(outsider);
      expect(names(await run<{ id: string }>(all))).toEqual(['mineElsewhere']);
    });
  });
});

describe('profiles: a user reads and edits their own; staff read the profiles of their organisation’s members', () => {
  const colleague = randomUUID();
  const former = randomUUID();
  const elsewhere = randomUUID();
  const nobody = randomUUID();
  const label = new Map([
    [cast.userSelf, 'self'],
    [colleague, 'colleague'],
    [former, 'former member'],
    [elsewhere, 'member elsewhere'],
    [nobody, 'no membership'],
    [staff.user as string, 'the staff user'],
  ]);
  const names = (rows: { id: string }[]) => rows.map((row) => label.get(row.id) ?? '?').sort();
  const profile = (id: string) =>
    sql`insert into profiles (id, full_name) values (${id}::uuid, 'Someone')`;
  const membership = (user: string, org: string, deleted = false) => sql`
    insert into memberships (org_id, user_id, kind, staff_id, status, deleted_at)
    values (${org}::uuid, ${user}::uuid, 'staff', ${randomUUID()}::uuid, 'active', ${deleted ? sql`now()` : sql`null`})`;
  const seed = [
    profile(cast.userSelf),
    profile(colleague),
    profile(former),
    profile(elsewhere),
    profile(nobody),
    profile(staff.user as string),
    membership(cast.userSelf, cast.orgA),
    membership(colleague, cast.orgA),
    membership(former, cast.orgA, true),
    membership(elsewhere, cast.orgB),
    membership(staff.user as string, cast.orgA),
  ];
  const all = sql`select id::text as id from profiles`;

  it('a guardian reads only their own profile', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      expect(names(await run<{ id: string }>(all))).toEqual(['self']);
    });
  });

  it('a user changes their own profile and nobody else’s', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      const changed = await attempt<{ id: string }>(
        sql`update profiles set full_name = 'Ayesha Malik' returning id::text as id`,
      );
      expect(names(changed.rows ?? [])).toEqual(['self']);
    });
  });

  it('a user can neither create a profile nor remove their own: the system does both', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      const fresh: Actor = { ...guardian, user: randomUUID() };
      await as(fresh);
      expect((await attempt(profile(fresh.user as string))).error).toBe(DENIED);
      await as(guardian);
      expect(
        (await attempt<{ id: string }>(sql`delete from profiles returning id::text as id`)).rows,
      ).toEqual([]);
    });
  });

  it('staff read the profiles of current members of their organisation only', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(staff);
      expect(names(await run<{ id: string }>(all))).toEqual([
        'colleague',
        'self',
        'the staff user',
      ]);
    });
  });

  it('staff cannot change another person’s profile', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      await as(staff);
      const changed = await attempt<{ id: string }>(
        sql`update profiles set full_name = 'Changed' returning id::text as id`,
      );
      expect(names(changed.rows ?? [])).toEqual(['the staff user']);
    });
  });

  it('staff of another organisation see none of these people except their own member', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(outsider);
      expect(names(await run<{ id: string }>(all))).toEqual(['member elsewhere']);
    });
  });
});
