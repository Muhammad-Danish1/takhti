import { randomUUID } from 'node:crypto';
import { sql, type SQL } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actors, cast, sandbox, type Actor } from '../../helpers/rls';
import { createTestDb, type TestDb } from '../../helpers/test-db';

/*
 * The academic tables whose access cannot be said as a rule of the registry (Wave 3):
 *   - an examination paper, confidential until the day of its exam, with its sections and questions;
 *   - a result and everything that hangs from it, which a family sees only once the result set is
 *     published, and in full only when the result is not withheld.
 * `custom-policies.test.ts` checks that every such table is covered by one of these files.
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
const A = sql`${cast.orgA}::uuid`;
const B = sql`${cast.orgB}::uuid`;
const branch = sql`${cast.branch1}::uuid`;
const anyId = () => sql`${randomUUID()}::uuid`;

describe('question papers: confidential until the day of the exam', () => {
  // The writer is a teacher with no special capability; so is a colleague. The controller approves papers.
  const writer = actor('staff without capabilities');
  const colleague: Actor = { ...writer, name: 'a colleague', user: randomUUID(), staffId: randomUUID() };
  const controller = actor('staff with every branch');
  const guardian = actor('guardian of family 1');
  const outsider = actor('staff of another organisation');

  const papers = {
    secret: randomUUID(), // the writer's own, confidential, exam next week
    undated: randomUUID(), // someone else's, confidential, no exam date yet
    sat: randomUUID(), // someone else's, confidential, exam was last week
    open: randomUUID(), // someone else's, never confidential
    elsewhere: randomUUID(), // another school's
  };
  const paper = (
    id: string,
    org: SQL,
    options: { by?: string; confidential?: boolean; opens?: SQL } = {},
  ) => sql`
    insert into question_papers (id, org_id, branch_id, grade_subject_id, title, total_marks, duration_minutes,
                                 created_by_staff_id, is_confidential, opens_on)
    values (${id}::uuid, ${org}, ${org === A ? branch : sql`${cast.branchB}::uuid`}, ${anyId()}, 'Mathematics, First Term', 75, 120,
            ${options.by ?? randomUUID()}::uuid, ${options.confidential ?? true}, ${options.opens ?? sql`null`})`;
  const sections = Object.fromEntries(Object.keys(papers).map((key) => [key, randomUUID()]));
  const section = (key: keyof typeof papers) => sql`
    insert into paper_sections (id, org_id, branch_id, question_paper_id, sort_order, title)
    values (${sections[key] as string}::uuid, ${key === 'elsewhere' ? B : A},
            ${key === 'elsewhere' ? sql`${cast.branchB}::uuid` : branch}, ${papers[key]}::uuid, 1, 'Section A')`;
  const question = (key: keyof typeof papers) => sql`
    insert into paper_questions (org_id, branch_id, question_paper_id, paper_section_id, sort_order, number_label, type, text, marks)
    values (${key === 'elsewhere' ? B : A}, ${key === 'elsewhere' ? sql`${cast.branchB}::uuid` : branch},
            ${papers[key]}::uuid, ${sections[key] as string}::uuid, 1, 'Q1', 'short', 'Define a prime number.', 2)`;
  const seed = [
    paper(papers.secret, A, { by: cast.staff1, opens: sql`current_date + 7` }),
    paper(papers.undated, A),
    paper(papers.sat, A, { opens: sql`current_date - 7` }),
    paper(papers.open, A, { confidential: false }),
    paper(papers.elsewhere, B, { confidential: false }),
    ...(Object.keys(papers) as (keyof typeof papers)[]).flatMap((key) => [section(key), question(key)]),
  ];
  const label = new Map<string, string>(Object.entries(papers).map(([name, id]) => [id, name]));
  const names = (rows: { id: string }[]) => rows.map((row) => label.get(row.id) ?? '?').sort();
  const readPapers = sql`select id::text as id from question_papers`;
  const readSections = sql`select question_paper_id::text as id from paper_sections`;
  const readQuestions = sql`select question_paper_id::text as id from paper_questions`;

  it('the writer reads their own paper before the exam; a colleague does not', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(writer);
      expect(names(await run<{ id: string }>(readPapers))).toEqual(['open', 'sat', 'secret']);
      await as(colleague);
      expect(names(await run<{ id: string }>(readPapers))).toEqual(['open', 'sat']);
    });
  });

  it('whoever approves papers reads every paper of the school, and no paper of another school', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(controller);
      expect(names(await run<{ id: string }>(readPapers))).toEqual([
        'open',
        'sat',
        'secret',
        'undated',
      ]);
      await as(outsider);
      expect(names(await run<{ id: string }>(readPapers))).toEqual(['elsewhere']);
    });
  });

  it('sections and questions follow their paper: hidden with it, shown with it', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(colleague);
      expect(names(await run<{ id: string }>(readSections))).toEqual(['open', 'sat']);
      expect(names(await run<{ id: string }>(readQuestions))).toEqual(['open', 'sat']);
      await as(writer);
      expect(names(await run<{ id: string }>(readQuestions))).toEqual(['open', 'sat', 'secret']);
      await as(controller);
      expect(names(await run<{ id: string }>(readQuestions))).toEqual([
        'open',
        'sat',
        'secret',
        'undated',
      ]);
    });
  });

  it('a colleague can neither change a confidential paper nor add a question to it', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      await as(colleague);
      const changed = await attempt<{ id: string }>(
        sql`update question_papers set title = 'Seen' returning id::text as id`,
      );
      expect(names(changed.rows ?? [])).toEqual(['open', 'sat']);
      const added = await attempt(sql`
        insert into paper_questions (org_id, branch_id, question_paper_id, paper_section_id, sort_order, number_label, type, text, marks)
        values (${A}, ${branch}, ${papers.secret}::uuid, ${sections.secret as string}::uuid, 2, 'Q2', 'short', 'An extra question', 2)`);
      expect(added.error).toBe(DENIED);
    });
  });

  it('a teacher writes a confidential paper of their own, and cannot write one in a colleague’s name', async () => {
    await sandbox(async ({ as, attempt }) => {
      await as(colleague);
      const own = await attempt(
        paper(randomUUID(), A, { by: colleague.staffId as string, opens: sql`current_date + 3` }),
      );
      expect(own.error).toBeUndefined();
      const forged = await attempt(
        paper(randomUUID(), A, { by: cast.staff1, opens: sql`current_date + 3` }),
      );
      expect(forged.error).toBe(DENIED);
    });
  });

  it('no family user reads any paper, question or section', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      expect(await run(readPapers)).toEqual([]);
      expect(await run(readSections)).toEqual([]);
      expect(await run(readQuestions)).toEqual([]);
    });
  });
});

describe('results: a family sees them once published, and in full only when not withheld', () => {
  const staff = actor('staff with every branch');
  const guardian = actor('guardian of family 1');
  const otherGuardian = actor('guardian of another family');
  const outsider = actor('staff of another organisation');

  // Two published sets (a child has one result in each set) and one that is still being reviewed.
  const sets = { published: randomUUID(), alsoPublished: randomUUID(), computed: randomUUID() };
  const results = {
    shown: randomUUID(), // own child, a published set
    withheld: randomUUID(), // own child, another published set, withheld for dues
    waiting: randomUUID(), // own child, the set is not published yet
    classmate: randomUUID(), // another family's child, published set
  };
  const resultSet = (id: string, status: string) => sql`
    insert into result_sets (id, org_id, branch_id, academic_year_id, kind, name, grade_ids, policy_id, grading_scheme_id, status)
    values (${id}::uuid, ${A}, ${branch}, ${anyId()}, 'term', ${`Result ${id.slice(0, 6)}`}, '{}', ${anyId()}, ${anyId()}, ${status})`;
  const result = (id: string, set: string, student: string, withheld = false) => sql`
    insert into results (id, org_id, branch_id, result_set_id, student_id, enrollment_id, section_id,
                         total_obtained, total_max, percent, outcome, is_withheld, withheld_reason, withheld_note)
    values (${id}::uuid, ${A}, ${branch}, ${set}::uuid, ${student}::uuid, ${anyId()}, ${anyId()}, 410, 500, 82, 'pass',
            ${withheld}, ${withheld ? 'fee_dues' : null}, ${withheld ? 'Please clear the dues to see the result.' : null})`;
  const subject = (resultId: string, student: string) => sql`
    insert into result_subjects (org_id, branch_id, result_id, student_id, grade_subject_id, subject_name, obtained, max, percent, status)
    values (${A}, ${branch}, ${resultId}::uuid, ${student}::uuid, ${anyId()}, 'English', 82, 100, 82, 'pass')`;
  const cards = Object.fromEntries(Object.keys(results).map((key) => [key, randomUUID()]));
  const card = (key: keyof typeof results, student: string, status = 'generated') => sql`
    insert into report_cards (id, org_id, branch_id, result_id, student_id, template_id, revision, status)
    values (${cards[key] as string}::uuid, ${A}, ${branch}, ${results[key]}::uuid, ${student}::uuid, ${anyId()}, 1, ${status})`;
  const score = (set: string, student: string) => sql`
    insert into co_scholastic_scores (org_id, branch_id, result_set_id, student_id, area_id, score, entered_by)
    values (${A}, ${branch}, ${set}::uuid, ${student}::uuid, ${anyId()}, 'A', ${anyId()})`;
  const pendingCard = randomUUID();
  const seed = [
    resultSet(sets.published, 'published'),
    resultSet(sets.alsoPublished, 'published'),
    resultSet(sets.computed, 'computed'),
    result(results.shown, sets.published, cast.student1),
    result(results.withheld, sets.alsoPublished, cast.student1, true),
    result(results.waiting, sets.computed, cast.student1),
    result(results.classmate, sets.published, cast.student2),
    subject(results.shown, cast.student1),
    subject(results.withheld, cast.student1),
    subject(results.waiting, cast.student1),
    subject(results.classmate, cast.student2),
    card('shown', cast.student1),
    card('withheld', cast.student1),
    card('waiting', cast.student1),
    card('classmate', cast.student2),
    // A second revision of the shown result whose card is not made yet.
    sql`insert into report_cards (id, org_id, branch_id, result_id, student_id, template_id, revision, status)
        values (${pendingCard}::uuid, ${A}, ${branch}, ${results.shown}::uuid, ${cast.student1}::uuid, ${anyId()}, 2, 'pending')`,
    score(sets.published, cast.student1),
    score(sets.computed, cast.student1),
    score(sets.published, cast.student2),
  ];

  const label = new Map<string, string>(Object.entries(results).map(([name, id]) => [id, name]));
  const names = (rows: { id: string }[]) => rows.map((row) => label.get(row.id) ?? '?').sort();
  const readResults = sql`select id::text as id from results`;
  const readSubjects = sql`select result_id::text as id from result_subjects`;
  const readCards = sql`select result_id::text as id from report_cards`;
  const readScores = sql`select result_set_id::text as id, student_id::text as student from co_scholastic_scores`;

  it('a guardian reads their child’s results of a published set, the withheld one included, and nothing unpublished', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      expect(names(await run<{ id: string }>(readResults))).toEqual(['shown', 'withheld']);
    });
  });

  it('subject marks are hidden for a withheld result and for an unpublished set', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      expect(names(await run<{ id: string }>(readSubjects))).toEqual(['shown']);
    });
  });

  it('a guardian reads only the finished report card of a shown result, and may acknowledge it', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      expect(names(await run<{ id: string }>(readCards))).toEqual(['shown']);
      const acknowledged = await attempt<{ id: string }>(sql`
        update report_cards set acknowledged_at = now() returning result_id::text as id`);
      expect(names(acknowledged.rows ?? [])).toEqual(['shown']);
      expect(acknowledged.rows).toHaveLength(1);
    });
  });

  it('co-scholastic scores appear with the published set only', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      expect(await run(readScores)).toEqual([{ id: sets.published, student: cast.student1 }]);
    });
  });

  it('another family sees nothing of this child, and staff see everything of their school', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(otherGuardian);
      expect(await run(readResults)).toEqual([]);
      expect(await run(readSubjects)).toEqual([]);
      expect(await run(readCards)).toEqual([]);
      expect(await run(readScores)).toEqual([]);
      await as(staff);
      expect(names(await run<{ id: string }>(readResults))).toEqual([
        'classmate',
        'shown',
        'waiting',
        'withheld',
      ]);
      expect(await run(readSubjects)).toHaveLength(4);
      expect(await run(readCards)).toHaveLength(5);
      expect(await run(readScores)).toHaveLength(3);
      await as(outsider);
      expect(await run(readResults)).toEqual([]);
      expect(await run(readCards)).toEqual([]);
    });
  });

  it('a family cannot write a result, a mark or a score', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      expect((await attempt(result(randomUUID(), sets.published, cast.student1))).error).toBe(DENIED);
      expect((await attempt(subject(results.shown, cast.student1))).error).toBe(DENIED);
      expect((await attempt(score(sets.published, cast.student1))).error).toBe(DENIED);
      const changed = await attempt<{ id: string }>(
        sql`update results set percent = 99 returning id::text as id`,
      );
      expect(changed.rows).toEqual([]);
    });
  });
});
