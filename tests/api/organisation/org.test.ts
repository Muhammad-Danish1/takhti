import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OnboardingTask, Org, OrgPublic } from '@takhti/contracts';
import {
  confirmUpload,
  createUpload,
  ledger,
  memoryStorage,
  setStorageProvider,
  type Actor,
} from '@takhti/core';
import {
  adminDb,
  auditLog,
  feeVouchers,
  files,
  fiscalPeriods,
  fiscalYears,
  orgs,
  withAdminTx,
} from '@takhti/db';
import * as complete from '../../../apps/web/app/api/v1/onboarding/[key]/complete/route';
import * as onboarding from '../../../apps/web/app/api/v1/onboarding/route';
import * as publicProfile from '../../../apps/web/app/api/v1/org/public/route';
import * as profile from '../../../apps/web/app/api/v1/org/route';
import { activeYear } from '../../helpers/classes';
import { callRoute } from '../../helpers/http';
import { makeStudent } from '../../helpers/people';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

/*
 * The school group's own profile and its setup checklist.
 * Rules and failure cases: docs/plan/10-modules/m02-organisation-branches.md.
 */

let db: TestDb;
let school: TestOrg;
let fresh: TestOrg;
let director: Actor;
let principal: Actor;
let teacher: Actor;
let accountant: Actor;
let guardian: Actor;
let freshDirector: Actor;
const store = memoryStorage();

const read = (actor: Actor) => callRoute<Org>(profile.GET, { as: actor, url: '/api/v1/org' });
const patch = (actor: Actor, body: unknown) =>
  callRoute<Org>(profile.PATCH, { as: actor, method: 'PATCH', url: '/api/v1/org', body });
const version = async (actor: Actor) => (await read(actor)).data.version;

beforeAll(async () => {
  db = await createTestDb();
  setStorageProvider(store);
  school = await seedOrg();
  fresh = await seedOrg();
  director = await school.actor('director');
  principal = await school.actor('principal');
  teacher = await school.actor('class_teacher');
  accountant = await school.actor('accountant');
  guardian = await school.actor('guardian');
  freshDirector = await fresh.actor('director');
});
afterAll(async () => {
  setStorageProvider(undefined);
  await db.destroy();
});

describe('the school profile', () => {
  it('staff read it; the director changes it; each change is audited with only what changed', async () => {
    const before = await read(teacher);
    expect(before.status).toBe(200);
    expect(before.data).toMatchObject({
      slug: school.slug,
      city: 'Lahore',
      province: 'punjab',
      academicYearStartMonth: 4,
      fiscalYearStartMonth: 7,
      billingMode: 'student',
      status: 'active',
      version: 1,
    });

    const changed = await patch(director, {
      version: 1,
      name: '  Roshan   Public School  ',
      phone: '042-35761234',
      address: '12 Canal Road',
      ntn: '1234567-8',
    });
    expect(changed.status).toBe(200);
    expect(changed.data).toMatchObject({
      name: 'Roshan Public School',
      phone: '+924235761234',
      address: '12 Canal Road',
      ntn: '1234567-8',
      version: 2,
    });
    const [entry] = await adminDb()
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, 'org'), eq(auditLog.entityId, school.orgId)));
    expect(entry).toMatchObject({ action: 'update', summary: 'Changed the school profile' });

    expect((await patch(principal, { version: 2, name: 'Mine now' })).status).toBe(403);
    expect((await read(guardian)).status).toBe(403);
    const wrong = await patch(director, { version: 2, fiscalYearStartMonth: 13, website: 'roshan' });
    expect(wrong.status).toBe(422);
    expect(Object.keys(wrong.error?.fields ?? {}).sort()).toEqual(['fiscalYearStartMonth', 'website']);
  });

  it('its slug and its status are the platform’s to change, not the school’s', async () => {
    const sent = await patch(director, {
      version: await version(director),
      slug: 'another-school',
      status: 'closed',
      city: 'Kasur',
    });
    expect(sent.data).toMatchObject({ slug: school.slug, status: 'active', city: 'Kasur' });
    const [row] = await adminDb().select().from(orgs).where(eq(orgs.id, school.orgId));
    expect(row).toMatchObject({ slug: school.slug, status: 'active' });
  });

  it('F-org-4 two people saving the profile at once: the second is told to reload', async () => {
    const seen = await version(director);
    expect((await patch(director, { version: seen, legalName: 'Roshan Education (Pvt) Ltd' })).status).toBe(
      200,
    );
    const second = await patch(director, { version: seen, legalName: 'Roshan Trust' });
    expect(second.status).toBe(409);
    expect(second.error).toMatchObject({
      code: 'STALE',
      message: 'The school profile was changed by someone else. Reload and try again.',
    });
    expect((await read(director)).data.legalName).toBe('Roshan Education (Pvt) Ltd');
  });

  it('F-org-5 a logo that never finished uploading is refused by name, and the profile saves without it', async () => {
    const ask = (mimeType: string, fileName: string) =>
      as(director, (ctx) => createUpload(ctx, { purpose: 'photo', fileName, mimeType, size: 4 }));
    const put = async (fileId: string, mimeType: string) => {
      const [file] = await adminDb().select().from(files).where(eq(files.id, fileId));
      await store.put(file!.bucket, file!.path, new Uint8Array([1, 2, 3, 4]), mimeType);
    };
    const unfinished = await ask('image/png', 'logo.png');
    const failed = await patch(director, {
      version: await version(director),
      name: 'Roshan Public School',
      logoFileId: unfinished.fileId,
    });
    expect(failed.status).toBe(422);
    expect(failed.error?.fields).toEqual({
      logoFileId: ['The logo has not finished uploading. Upload it again.'],
    });
    // The same form, sent again without the logo, is saved.
    const without = await patch(director, {
      version: await version(director),
      name: 'Roshan Public School',
      logoFileId: null,
    });
    expect(without.data.logoFileId).toBeNull();
    expect((await patch(director, { version: without.data.version, logoFileId: randomUUID() })).status).toBe(
      422,
    );

    // And the retry, once the upload has gone through.
    await put(unfinished.fileId, 'image/png');
    await as(director, (ctx) => confirmUpload(ctx, unfinished.fileId));
    const withLogo = await patch(director, {
      version: without.data.version,
      logoFileId: unfinished.fileId,
    });
    expect(withLogo.data.logoFileId).toBe(unfinished.fileId);
  });

  it('R-org-7 the way of billing changes only when none of this month’s vouchers is open', async () => {
    const voucherId = randomUUID();
    await withAdminTx(async (tx) => {
      const base = { orgId: school.orgId, now: TEST_NOW };
      const student = await makeStudent(tx, {
        ...base,
        branchId: school.mainBranchId,
        fullName: 'Hira Baig',
      });
      const academicYearId = await activeYear(tx, base);
      const voucher = (id: string, voucherNo: string, billingMonth: string) =>
        tx.insert(feeVouchers).values({
          id,
          orgId: school.orgId,
          createdAt: TEST_NOW,
          updatedAt: TEST_NOW,
          branchId: school.mainBranchId,
          voucherNo,
          challanNo: voucherNo,
          studentId: student.studentId,
          familyId: student.familyId,
          academicYearId,
          billingMonth,
          periodLabel: billingMonth,
          issueDate: billingMonth,
          dueDate: billingMonth,
          total: 450_000,
        });
      await voucher(voucherId, 'TV-2610-000001', '2026-10-01');
      // Last month's arrears do not hold the change back: it is this month's run that must be whole.
      await voucher(randomUUID(), 'TV-2609-000001', '2026-09-01');
    });

    const blocked = await patch(director, { version: await version(director), billingMode: 'family' });
    expect(blocked.status).toBe(409);
    expect(blocked.error).toMatchObject({
      code: 'RULE',
      message: 'The way of billing cannot change yet: 1 of this month\'s voucher is still open',
    });
    // Sending the mode it already has is no change, and so is not refused.
    expect((await patch(director, { version: await version(director), billingMode: 'student' })).status).toBe(
      200,
    );

    await adminDb()
      .update(feeVouchers)
      .set({ status: 'paid', paid: 450_000 })
      .where(eq(feeVouchers.id, voucherId));
    const allowed = await patch(director, { version: await version(director), billingMode: 'family' });
    expect(allowed.data.billingMode).toBe('family');
  });

  it('R-org-8 the month the academic year starts in is fixed once a year exists', async () => {
    const moved = await patch(freshDirector, { version: 1, academicYearStartMonth: 8 });
    expect(moved.data.academicYearStartMonth).toBe(8);
    await withAdminTx((tx) => activeYear(tx, { orgId: fresh.orgId, now: TEST_NOW }));
    const refused = await patch(freshDirector, { version: 2, academicYearStartMonth: 4 });
    expect(refused.status).toBe(409);
    expect(refused.error?.message).toMatch(/cannot change once an academic year exists/);
    // The rest of the profile is still its own to change.
    expect((await patch(freshDirector, { version: 2, academicYearStartMonth: 8, city: 'Multan' })).status).toBe(
      200,
    );
  });

  it('R-org-8 while the first fiscal year is untouched, changing its month rebuilds the year around today', async () => {
    const yearOf = async () => {
      const [year] = await adminDb().select().from(fiscalYears).where(eq(fiscalYears.orgId, fresh.orgId));
      const periods = await adminDb()
        .select()
        .from(fiscalPeriods)
        .where(eq(fiscalPeriods.fiscalYearId, year!.id))
        .orderBy(asc(fiscalPeriods.periodNo));
      return { year: year!, periods };
    };
    const before = await yearOf();
    expect(before.year).toMatchObject({ name: 'FY 2026–27', startsOn: '2026-07-01', endsOn: '2027-06-30' });

    const moved = await patch(freshDirector, {
      version: await version(freshDirector),
      fiscalYearStartMonth: 1,
    });
    expect(moved.data.fiscalYearStartMonth).toBe(1);
    const after = await yearOf();
    // The same year and the same twelve periods, moved: nothing was deleted and made again.
    expect(after.year).toMatchObject({
      id: before.year.id,
      name: 'FY 2026',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
    });
    expect(after.periods.map((period) => period.id)).toEqual(before.periods.map((period) => period.id));
    expect(after.periods).toHaveLength(12);
    expect(after.periods[0]).toMatchObject({ periodNo: 1, name: 'January 2026', startsOn: '2026-01-01' });
    expect(after.periods[11]).toMatchObject({ periodNo: 12, name: 'December 2026', endsOn: '2026-12-31' });
  });

  it('R-org-8 once the fiscal year has been used, its month no longer changes', async () => {
    // The first school's books have an entry.
    await as(accountant, (ctx) =>
      ledger.post(ctx, {
        journal: 'FEE',
        date: '2026-10-12',
        branchId: school.mainBranchId,
        memo: 'Fee receipt',
        source: { type: 'fee_payment', id: randomUUID() },
        lines: [
          { account: { key: 'cash.counter' }, branchId: school.mainBranchId, debit: 5_000 },
          { account: { key: 'fees.receivable' }, branchId: school.mainBranchId, credit: 5_000 },
        ],
      }),
    );
    const used = await patch(director, { version: await version(director), fiscalYearStartMonth: 1 });
    expect(used.status).toBe(409);
    expect(used.error?.message).toBe(
      'The month the fiscal year starts in cannot change now: the fiscal year is already in use',
    );

    // The second school closes a period: that is use too.
    const [period] = await adminDb()
      .select()
      .from(fiscalPeriods)
      .where(and(eq(fiscalPeriods.orgId, fresh.orgId), eq(fiscalPeriods.periodNo, 1)));
    await adminDb().update(fiscalPeriods).set({ status: 'closed' }).where(eq(fiscalPeriods.id, period!.id));
    const closed = await patch(freshDirector, {
      version: await version(freshDirector),
      fiscalYearStartMonth: 7,
    });
    expect(closed.status).toBe(409);
    await adminDb().update(fiscalPeriods).set({ status: 'open' }).where(eq(fiscalPeriods.id, period!.id));

    // And so is a second year beside the first.
    await adminDb().insert(fiscalYears).values({
      id: randomUUID(),
      orgId: fresh.orgId,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
      name: 'FY 2027',
      startsOn: '2027-01-01',
      endsOn: '2027-12-31',
    });
    const second = await patch(freshDirector, {
      version: await version(freshDirector),
      fiscalYearStartMonth: 7,
    });
    expect(second.status).toBe(409);
    expect((await read(freshDirector)).data.fiscalYearStartMonth).toBe(1);
  });
});

describe('what a family may know about the school', () => {
  it('T-org-8 a guardian reads the public profile: the name, the logo and how to reach the school, and no more', async () => {
    const seen = await callRoute<OrgPublic>(publicProfile.GET, {
      as: guardian,
      url: '/api/v1/org/public',
    });
    expect(seen.status).toBe(200);
    expect(Object.keys(seen.data).sort()).toEqual([
      'address',
      'city',
      'defaultLocale',
      'email',
      'id',
      'logoFileId',
      'name',
      'nameUr',
      'phone',
      'website',
    ]);
    expect(seen.data).toMatchObject({ name: 'Roshan Public School', phone: '+924235761234' });

    expect((await read(guardian)).status).toBe(403);
    expect((await patch(guardian, { version: 1, name: 'Ours' })).status).toBe(403);
    expect((await callRoute(onboarding.GET, { as: guardian, url: '/api/v1/onboarding' })).status).toBe(403);
    expect((await callRoute(publicProfile.GET, { url: '/api/v1/org/public' })).status).toBe(401);
  });
});

describe('the setup checklist', () => {
  const list = (actor: Actor) =>
    callRoute<OnboardingTask[]>(onboarding.GET, { as: actor, url: '/api/v1/onboarding' });
  const tick = (actor: Actor, key: string, status: string) =>
    callRoute<OnboardingTask>(complete.POST, {
      as: actor,
      method: 'POST',
      url: '/x',
      params: { key },
      body: { status },
    });

  it('lists the tasks in their order, with what was ticked and what the system can already see', async () => {
    const tasks = await list(teacher);
    expect(tasks.status).toBe(200);
    expect(tasks.data.map((task) => task.key)).toEqual([
      'profile',
      'academic_year',
      'grades',
      'sections',
      'subjects',
      'fee_structure',
      'staff',
      'students',
      'first_voucher_run',
    ]);
    expect(tasks.data.every((task) => task.status === 'pending' && task.completedAt === null)).toBe(true);
    const detected = Object.fromEntries(tasks.data.map((task) => [task.key, task.detected]));
    // The profile has its address and phone, there is a year, a student and several staff; nothing else yet.
    expect(detected).toEqual({
      profile: true,
      academic_year: true,
      grades: true,
      sections: false,
      subjects: false,
      fee_structure: false,
      staff: true,
      students: true,
      first_voucher_run: false,
    });
  });

  it('a task is ticked as done or skipped by an administrator, and the tick can be changed', async () => {
    const done = await tick(principal, 'profile', 'done');
    expect(done.status).toBe(200);
    expect(done.data).toMatchObject({ key: 'profile', status: 'done', detected: true });
    expect(done.data.completedAt).not.toBeNull();
    expect((await tick(principal, 'fee_structure', 'skipped')).data.status).toBe('skipped');
    expect((await tick(principal, 'fee_structure', 'done')).data.status).toBe('done');

    const statuses = Object.fromEntries((await list(principal)).data.map((task) => [task.key, task.status]));
    expect(statuses).toMatchObject({ profile: 'done', fee_structure: 'done', grades: 'pending' });

    expect((await tick(teacher, 'grades', 'done')).status).toBe(403);
    expect((await tick(principal, 'canteen', 'done')).status).toBe(422);
    expect((await tick(principal, 'grades', 'pending')).status).toBe(422);
    // Another school's checklist is its own.
    const elsewhere = await list(freshDirector);
    expect(elsewhere.data.every((task) => task.status === 'pending')).toBe(true);
  });
});
