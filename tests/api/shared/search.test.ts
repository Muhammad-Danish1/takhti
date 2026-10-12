import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_SEARCH_HITS, type SearchKind, type SearchResults } from '@takhti/contracts';
import type { Actor } from '@takhti/core';
import { adminDb, feeVouchers, guardians, students, withAdminTx } from '@takhti/db';
import * as search from '../../../apps/web/app/api/v1/search/route';
import {
  assignSubjectTeacher,
  enrol,
  makeSection,
  makeWing,
  type MadeSection,
} from '../../helpers/classes';
import { callRoute } from '../../helpers/http';
import { linkGuardian, makeGuardian, makeStudent } from '../../helpers/people';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

/*
 * Global search: docs/plan/10-modules/m00-shared-kernel.md, rule R-shared-14 and test T-shared-11.
 *
 * The school of these tests:
 *   Main Campus   Grade 1 – A   class teacher: the class teacher     Zainab Raza
 *                 Grade 2 – A   Mathematics: the subject teacher     Zainab Malik, nine "Hamza Bulk"
 *                 the Primary wing (Grade 1 only) is led by the section head
 *                 no class                                           Zainab Akhtar, who has left
 *   City Campus   Grade 1 – A                                        Zainab Iqbal
 */

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let director: Actor;
let principal: Actor;
let cityPrincipal: Actor;
let accountant: Actor;
let teacher: Actor;
let subjectTeacher: Actor;
let sectionHead: Actor;
let guardian: Actor;
let outsider: Actor;
let razaGuardianPhone: string;

const B_FORM = '35202-7654321-8';
const CNIC = '35201-1122334-5';

async function ask(actor: Actor, query: string) {
  return callRoute<SearchResults>(search.GET, { as: actor, url: `/api/v1/search?${query}` });
}

/** The titles found of one kind, or null when that kind was not searched for this person at all. */
async function found(actor: Actor, q: string, kind: SearchKind): Promise<string[] | null> {
  const result = await ask(actor, `q=${encodeURIComponent(q)}`);
  expect(result.status).toBe(200);
  const group = result.data.groups.find((candidate) => candidate.kind === kind);
  return group ? group.hits.map((hit) => hit.title) : null;
}

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  other = await seedOrg();
  director = await school.actor('director');
  principal = await school.actor('principal');
  cityPrincipal = await school.actor('principal', { branch: 'city' });
  accountant = await school.actor('accountant');
  teacher = await school.actor('class_teacher');
  subjectTeacher = await school.actor('subject_teacher');
  sectionHead = await school.actor('section_head');
  guardian = await school.actor('guardian');
  outsider = await other.actor('principal');

  const base = { orgId: school.orgId, now: TEST_NOW };
  await withAdminTx(async (tx) => {
    const oneA = await makeSection(tx, {
      ...base,
      branchId: school.mainBranchId,
      level: 1,
      name: 'A',
      classTeacherId: teacher.staffId as string,
    });
    const twoA = await makeSection(tx, { ...base, branchId: school.mainBranchId, level: 2, name: 'A' });
    const cityOneA = await makeSection(tx, { ...base, branchId: school.cityBranchId, level: 1, name: 'A' });
    await assignSubjectTeacher(tx, { ...base, section: twoA, teacherId: subjectTeacher.staffId as string });
    await makeWing(tx, {
      ...base,
      branchId: school.mainBranchId,
      name: 'Primary',
      gradeFrom: 1,
      gradeTo: 1,
      headStaffId: sectionHead.staffId as string,
    });

    const seat = async (fullName: string, section: MadeSection | null, branchId: string) => {
      const made = await makeStudent(tx, { ...base, branchId, fullName });
      if (section) await enrol(tx, { ...base, studentId: made.studentId, section });
      return made;
    };
    const raza = await seat('Zainab Raza', oneA, school.mainBranchId);
    const malik = await seat('Zainab Malik', twoA, school.mainBranchId);
    await seat('Zainab Iqbal', cityOneA, school.cityBranchId);
    const akhtar = await seat('Zainab Akhtar', null, school.mainBranchId);
    for (let index = 1; index <= MAX_SEARCH_HITS + 1; index++)
      await seat(`Hamza Bulk ${index}`, twoA, school.mainBranchId);

    await tx
      .update(students)
      .set({ fullNameUr: 'زینب رضا', bFormNo: B_FORM })
      .where(eq(students.id, raza.studentId));
    await tx
      .update(students)
      .set({ status: 'left', leftOn: '2026-06-30' })
      .where(eq(students.id, akhtar.studentId));

    const razaFather = await makeGuardian(tx, { ...base, fullName: 'Kamran Raza', familyId: raza.familyId });
    await linkGuardian(tx, { ...base, studentId: raza.studentId, guardianId: razaFather.guardianId });
    await tx.update(guardians).set({ cnic: CNIC }).where(eq(guardians.id, razaFather.guardianId));
    const malikFather = await makeGuardian(tx, { ...base, fullName: 'Kamran Malik', familyId: malik.familyId });
    await linkGuardian(tx, { ...base, studentId: malik.studentId, guardianId: malikFather.guardianId });
    const [row] = await tx
      .select({ phone: guardians.phone })
      .from(guardians)
      .where(eq(guardians.id, razaFather.guardianId));
    razaGuardianPhone = row?.phone as string;

    const voucher = (voucherNo: string, student: { studentId: string; familyId: string }, section: MadeSection) =>
      tx.insert(feeVouchers).values({
        id: randomUUID(),
        ...base,
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
        branchId: section.branchId,
        voucherNo,
        challanNo: voucherNo,
        studentId: student.studentId,
        familyId: student.familyId,
        academicYearId: section.academicYearId,
        billingMonth: '2026-10-01',
        periodLabel: 'October 2026',
        issueDate: '2026-10-01',
        dueDate: '2026-10-10',
        total: 450_000,
      });
    await voucher('TV-2610-000123', raza, oneA);
    await voucher('TV-2610-000124', malik, twoA);
  });

  await withAdminTx(async (tx) => {
    await makeStudent(tx, {
      orgId: other.orgId,
      now: TEST_NOW,
      branchId: other.mainBranchId,
      fullName: 'Zainab Elsewhere',
    });
  });
});
afterAll(async () => {
  await db.destroy();
});

describe('global search', () => {
  it('T-shared-11 / R-shared-14 a person finds only the students of their own branches, and of their own school', async () => {
    // Those still at the school first, then by name.
    expect(await found(principal, 'zainab', 'students')).toEqual([
      'Zainab Malik',
      'Zainab Raza',
      'Zainab Akhtar',
    ]);
    expect(await found(cityPrincipal, 'zainab', 'students')).toEqual(['Zainab Iqbal']);
    expect(await found(director, 'zainab', 'students')).toEqual([
      'Zainab Iqbal',
      'Zainab Malik',
      'Zainab Raza',
      'Zainab Akhtar',
    ]);
    expect(await found(outsider, 'zainab', 'students')).toEqual(['Zainab Elsewhere']);
  });

  it('T-shared-11 / R-shared-14 a teacher finds only the students of the sections they teach, and a section head those of their wing', async () => {
    expect(await found(teacher, 'zainab', 'students')).toEqual(['Zainab Raza']);
    expect(await found(subjectTeacher, 'zainab', 'students')).toEqual(['Zainab Malik']);
    expect(await found(sectionHead, 'zainab', 'students')).toEqual(['Zainab Raza']);
    // And so with the guardians of those students.
    expect(await found(principal, 'kamran', 'guardians')).toEqual(['Kamran Malik', 'Kamran Raza']);
    expect(await found(teacher, 'kamran', 'guardians')).toEqual(['Kamran Raza']);
    expect(await found(subjectTeacher, 'kamran', 'guardians')).toEqual(['Kamran Malik']);
  });

  it('R-shared-14 there are at most eight of a kind', async () => {
    const result = await ask(principal, 'q=hamza+bulk');
    const group = result.data.groups.find((candidate) => candidate.kind === 'students');
    expect(group?.hits).toHaveLength(MAX_SEARCH_HITS);
    expect(group?.hits[0]).toMatchObject({
      kind: 'students',
      title: 'Hamza Bulk 1',
      status: 'active',
      branchId: school.mainBranchId,
    });
    expect(group?.hits[0]?.subtitle).toMatch(/^TA-\d+ · Farhan Ahmed$/);
  });

  it('a kind the person may not search is not in the answer; a family is shown nothing', async () => {
    const forPrincipal = await ask(principal, 'q=zz-nothing');
    expect(forPrincipal.data.groups).toEqual([
      { kind: 'students', hits: [] },
      { kind: 'guardians', hits: [] },
      { kind: 'staff', hits: [] },
      { kind: 'vouchers', hits: [] },
    ]);
    // A subject teacher may not see vouchers.
    expect(await found(subjectTeacher, 'TV-2610', 'vouchers')).toBeNull();
    expect((await ask(guardian, 'q=zainab')).data.groups).toEqual([]);
  });

  it('only the kinds asked for are searched', async () => {
    const one = await ask(principal, 'q=zainab&kinds=staff');
    expect(one.data.groups.map((group) => group.kind)).toEqual(['staff']);
    const two = await ask(principal, 'q=zainab&kinds=guardians,students');
    expect(two.data.groups.map((group) => group.kind)).toEqual(['students', 'guardians']);
    expect((await ask(principal, 'q=zainab&kinds=rooms')).status).toBe(422);
  });

  it('needs at least two characters, and what was typed is text, never a pattern', async () => {
    const short = await ask(principal, 'q=z');
    expect(short.status).toBe(422);
    expect(short.error?.fields).toEqual({ q: ['Type at least two characters'] });
    expect((await ask(principal, 'q=++')).status).toBe(422);
    expect((await ask(principal, '')).status).toBe(422);
    for (const wild of ['%%', '__', '%a%']) {
      const result = await ask(principal, `q=${encodeURIComponent(wild)}`);
      expect(result.data.groups.every((group) => group.hits.length === 0)).toBe(true);
    }
  });

  it('a B-Form or CNIC number finds a person only for someone who may see such numbers', async () => {
    expect(await found(accountant, '7654321', 'students')).toEqual(['Zainab Raza']);
    expect(await found(accountant, '1122334', 'guardians')).toEqual(['Kamran Raza']);
    // Her own class teacher may open her record, but not find her by a number they cannot see.
    expect(await found(teacher, '7654321', 'students')).toEqual([]);
    expect(await found(teacher, '1122334', 'guardians')).toEqual([]);
  });

  it('a phone number is found however it was typed, and an Urdu name whichever keyboard typed it', async () => {
    const local = `0${razaGuardianPhone.slice(3, 6)} ${razaGuardianPhone.slice(6)}`;
    expect(local).toMatch(/^0300 \d{7}$/);
    expect(await found(principal, local, 'guardians')).toEqual(['Kamran Raza']);
    expect(await found(principal, razaGuardianPhone, 'guardians')).toEqual(['Kamran Raza']);
    expect(await found(principal, razaGuardianPhone.slice(-6), 'guardians')).toEqual(['Kamran Raza']);

    // Stored with the Urdu yeh; typed here with the Arabic one.
    const result = await ask(principal, `q=${encodeURIComponent('زينب')}`);
    const group = result.data.groups.find((candidate) => candidate.kind === 'students');
    expect(group?.hits.map((hit) => [hit.title, hit.titleUr])).toEqual([['Zainab Raza', 'زینب رضا']]);
  });

  it('staff are found by name or employee number', async () => {
    const result = await ask(teacher, 'q=rubina');
    const group = result.data.groups.find((candidate) => candidate.kind === 'staff');
    expect(group?.hits.map((hit) => hit.title)).toEqual(['Rubina Qureshi', 'Rubina Qureshi']);
    expect(group?.hits[0]).toMatchObject({ kind: 'staff', status: 'active' });
    const employeeNo = group?.hits[0]?.subtitle as string;
    expect(employeeNo).toMatch(/^T-\d+$/);
    expect(await found(principal, employeeNo, 'staff')).toEqual(['Rubina Qureshi']);
    expect(await found(outsider, 'nadia', 'staff')).toEqual([]);
  });

  it('a voucher is found by its number, in the branches and classes the person may see', async () => {
    const result = await ask(accountant, 'q=000123');
    const group = result.data.groups.find((candidate) => candidate.kind === 'vouchers');
    expect(group?.hits).toEqual([
      {
        kind: 'vouchers',
        id: expect.any(String) as string,
        title: 'TV-2610-000123',
        titleUr: null,
        subtitle: 'Zainab Raza · October 2026',
        status: 'unpaid',
        branchId: school.mainBranchId,
      },
    ]);
    expect(await found(accountant, 'tv-2610', 'vouchers')).toEqual(['TV-2610-000124', 'TV-2610-000123']);
    expect(await found(cityPrincipal, 'TV-2610', 'vouchers')).toEqual([]);
    // A class teacher follows up the dues of their own class, and finds no other.
    expect(await found(teacher, 'TV-2610', 'vouchers')).toEqual(['TV-2610-000123']);
    expect(await adminDb().$count(feeVouchers)).toBe(2);
  });
});
