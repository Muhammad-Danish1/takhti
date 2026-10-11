import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actors, cast, sandbox, type Actor } from '../../helpers/rls';
import { createTestDb, type TestDb } from '../../helpers/test-db';

/*
 * Chat (Wave 7). A conversation belongs to the people in it: being staff opens nothing. The only
 * way to read a thread or its messages is a row in `chat_participants`, and nobody can give
 * themselves one. `custom-policies.test.ts` checks that every table with a hand-written policy is
 * covered by one of these files.
 */

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
const DENIED = '42501';

const teacher = actor('staff with every branch');
const colleague = actor('staff without capabilities');
const mother = actor('guardian of family 1');
const otherParent = actor('guardian of another family');
const outsider = actor('staff of another organisation');
const userOf = (who: Actor) => who.user as string;

const threads = {
  withTeacher: randomUUID(), // the mother and the teacher
  classGroup: randomUUID(), // the teacher, the mother and the other parent
  others: randomUUID(), // the other parent and the colleague
  elsewhere: randomUUID(), // another school's, with the mother's user in it
};
const thread = (id: string, org: string, branch: string) => sql`
  insert into chat_threads (id, org_id, branch_id, kind, created_by)
  values (${id}::uuid, ${org}::uuid, ${branch}::uuid, 'parent_office', ${randomUUID()}::uuid)`;
const member = (
  threadId: string,
  org: string,
  branch: string,
  user: string,
  options: { canPost?: boolean; left?: boolean } = {},
) => sql`
  insert into chat_participants (org_id, branch_id, thread_id, user_id, role, can_post, left_at)
  values (${org}::uuid, ${branch}::uuid, ${threadId}::uuid, ${user}::uuid, 'guardian', ${options.canPost ?? true},
          ${options.left ? sql`now()` : sql`null`})`;
const messages = {
  hello: randomUUID(), // in the class group, from the teacher, for everyone
  privateReply: randomUUID(), // in the class group, from the mother, privately to the teacher
  inOthers: randomUUID(), // in the thread the mother is not part of
};
const message = (
  id: string,
  threadId: string,
  sender: string,
  options: { privateTo?: string; org?: string; branch?: string } = {},
) => sql`
  insert into chat_messages (id, org_id, branch_id, thread_id, sender_id, body, private_to_user_id, sent_at, client_id)
  values (${id}::uuid, ${options.org ?? cast.orgA}::uuid, ${options.branch ?? cast.branch1}::uuid, ${threadId}::uuid,
          ${sender}::uuid, 'Assalam o alaikum', ${options.privateTo ?? null}::uuid, now(), ${randomUUID()}::uuid)`;

const seed = [
  thread(threads.withTeacher, cast.orgA, cast.branch1),
  thread(threads.classGroup, cast.orgA, cast.branch1),
  thread(threads.others, cast.orgA, cast.branch1),
  thread(threads.elsewhere, cast.orgB, cast.branchB),
  member(threads.withTeacher, cast.orgA, cast.branch1, userOf(mother)),
  member(threads.withTeacher, cast.orgA, cast.branch1, userOf(teacher)),
  member(threads.classGroup, cast.orgA, cast.branch1, userOf(teacher)),
  member(threads.classGroup, cast.orgA, cast.branch1, userOf(mother)),
  member(threads.classGroup, cast.orgA, cast.branch1, userOf(otherParent), { canPost: false }),
  member(threads.others, cast.orgA, cast.branch1, userOf(otherParent)),
  member(threads.others, cast.orgA, cast.branch1, userOf(colleague)),
  // The mother was once in the other thread and has left it.
  member(threads.others, cast.orgA, cast.branch1, userOf(mother), { left: true }),
  member(threads.elsewhere, cast.orgB, cast.branchB, userOf(mother)),
  message(messages.hello, threads.classGroup, userOf(teacher)),
  message(messages.privateReply, threads.classGroup, userOf(mother), {
    privateTo: userOf(teacher),
  }),
  message(messages.inOthers, threads.others, userOf(colleague)),
];

const threadName = new Map<string, string>(Object.entries(threads).map(([name, id]) => [id, name]));
const messageName = new Map<string, string>(
  Object.entries(messages).map(([name, id]) => [id, name]),
);
const names = (rows: { id: string }[], from: Map<string, string>) =>
  rows.map((row) => from.get(row.id) ?? '?').sort();
const allThreads = sql`select id::text as id from chat_threads`;
const allMessages = sql`select id::text as id from chat_messages`;

describe('chat threads: read only by the people in them', () => {
  it('a guardian reads the threads they are in, not one they have left, and none of another school', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(mother);
      expect(names(await run<{ id: string }>(allThreads), threadName)).toEqual([
        'classGroup',
        'withTeacher',
      ]);
    });
  });

  it('being staff opens nothing: a teacher reads only the threads they are in', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(teacher);
      expect(names(await run<{ id: string }>(allThreads), threadName)).toEqual([
        'classGroup',
        'withTeacher',
      ]);
      await as(colleague);
      expect(names(await run<{ id: string }>(allThreads), threadName)).toEqual(['others']);
      await as(outsider);
      expect(await run(allThreads)).toEqual([]);
    });
  });

  it('nobody can put themselves into a thread, or change who is in one', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      for (const who of [mother, teacher]) {
        await as(who);
        expect(
          (await attempt(member(threads.others, cast.orgA, cast.branch1, userOf(who)))).error,
        ).toBe(DENIED);
        // Coming back into a thread one has left is refused in the same way: nothing changes.
        expect(
          (
            await attempt<{ id: string }>(
              sql`update chat_participants set left_at = null, can_post = true returning id::text as id`,
            )
          ).rows,
        ).toEqual([]);
        expect(
          (
            await attempt<{ id: string }>(
              sql`delete from chat_participants returning id::text as id`,
            )
          ).rows,
        ).toEqual([]);
      }
    });
  });

  it('a participant sees their own place in a thread and nobody else’s', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(mother);
      const rows = await run<{ user_id: string }>(
        sql`select user_id::text as user_id from chat_participants`,
      );
      expect(new Set(rows.map((row) => row.user_id))).toEqual(new Set([userOf(mother)]));
      // Her rows in this school only: the two threads she is in, and the one she left.
      expect(rows).toHaveLength(3);
    });
  });

  it('nobody opens or changes a thread except through the service', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      for (const who of [mother, teacher]) {
        await as(who);
        expect((await attempt(thread(randomUUID(), cast.orgA, cast.branch1))).error).toBe(DENIED);
        expect(
          (
            await attempt<{ id: string }>(
              sql`update chat_threads set status = 'closed' returning id::text as id`,
            )
          ).rows,
        ).toEqual([]);
      }
    });
  });
});

describe('chat messages: read by the thread, a private reply by two people only', () => {
  it('a participant reads the messages of their threads', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(mother);
      expect(names(await run<{ id: string }>(allMessages), messageName)).toEqual([
        'hello',
        'privateReply',
      ]);
      await as(colleague);
      expect(names(await run<{ id: string }>(allMessages), messageName)).toEqual(['inOthers']);
    });
  });

  it('a private reply is read by its sender and the person it was sent to, not by the rest of the thread', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(teacher);
      expect(names(await run<{ id: string }>(allMessages), messageName)).toEqual([
        'hello',
        'privateReply',
      ]);
      // The other parent is in the same thread, and in another one besides.
      await as(otherParent);
      expect(names(await run<{ id: string }>(allMessages), messageName)).toEqual([
        'hello',
        'inOthers',
      ]);
    });
  });

  it('a participant posts as themselves, in a thread they are in, when they are allowed to post', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      await as(mother);
      expect(
        (await attempt(message(randomUUID(), threads.withTeacher, userOf(mother)))).error,
      ).toBeUndefined();
      // Not under another person's name, not in a thread she has left, not in another school's.
      expect(
        (await attempt(message(randomUUID(), threads.withTeacher, userOf(teacher)))).error,
      ).toBe(DENIED);
      expect((await attempt(message(randomUUID(), threads.others, userOf(mother)))).error).toBe(
        DENIED,
      );
      expect(
        (
          await attempt(
            message(randomUUID(), threads.elsewhere, userOf(mother), {
              org: cast.orgB,
              branch: cast.branchB,
            }),
          )
        ).error,
      ).toBe(DENIED);
      // The other parent may read the class group but not write in it.
      await as(otherParent);
      expect(
        (await attempt(message(randomUUID(), threads.classGroup, userOf(otherParent)))).error,
      ).toBe(DENIED);
      expect(
        (await attempt(message(randomUUID(), threads.others, userOf(otherParent)))).error,
      ).toBeUndefined();
    });
  });

  it('nobody changes or removes a message except through the service', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      for (const who of [mother, teacher]) {
        await as(who);
        expect(
          (
            await attempt<{ id: string }>(
              sql`update chat_messages set body = 'changed' returning id::text as id`,
            )
          ).rows,
        ).toEqual([]);
        expect(
          (await attempt<{ id: string }>(sql`delete from chat_messages returning id::text as id`))
            .rows,
        ).toEqual([]);
      }
    });
  });

  it('another school sees none of it', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(outsider);
      expect(await run(allMessages)).toEqual([]);
    });
  });
});
