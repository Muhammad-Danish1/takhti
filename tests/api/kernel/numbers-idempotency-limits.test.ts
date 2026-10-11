import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertModule,
  checkLimit,
  clearBranchSetting,
  enabledModules,
  getSetting,
  hashRequest,
  invalidateModules,
  limit,
  nextNumber,
  nextValue,
  purgeExpiredIdempotencyKeys,
  purgeRateLimits,
  resolveSetting,
  setSetting,
  withIdempotency,
  type Actor,
} from '@takhti/core';
import {
  defineSetting,
  generalNumberFormats,
  generalWorkingWeek,
  securitySessionHours,
} from '@takhti/contracts';
import {
  adminDb,
  auditLog,
  idempotencyKeys,
  orgModules,
  orgSettings,
  rooms,
  withAdminTx,
} from '@takhti/db';
import { z } from 'zod';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, expectError, freezeTime, seedOrg, type TestOrg } from '../../helpers/world';

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let principal: Actor;
let cashier: Actor;

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  other = await seedOrg();
  principal = await school.actor('principal');
  cashier = await school.actor('cashier');
});
afterAll(async () => {
  freezeTime();
  await db.destroy();
});

describe('numbers', () => {
  it('counts up from 1 and formats with the date', async () => {
    freezeTime('2026-10-12T06:00:00.000Z');
    const numbers = await as(cashier, async (ctx) => [
      await nextNumber(ctx, 'receipt', { period: '2610', format: 'R-{yymm}-{00000}' }),
      await nextNumber(ctx, 'receipt', { period: '2610', format: 'R-{yymm}-{00000}' }),
    ]);
    expect(numbers).toEqual(['R-2610-00001', 'R-2610-00002']);
    freezeTime();
  });

  it('keeps a separate run per branch and per period', async () => {
    const values = await as(principal, async (ctx) => ({
      main: await nextValue(ctx, 'admission', { branchId: school.mainBranchId, period: '26' }),
      mainAgain: await nextValue(ctx, 'admission', { branchId: school.mainBranchId, period: '26' }),
      nextYear: await nextValue(ctx, 'admission', { branchId: school.mainBranchId, period: '27' }),
      noBranch: await nextValue(ctx, 'admission', { period: '26' }),
      noBranchAgain: await nextValue(ctx, 'admission', { period: '26' }),
    }));
    expect(values).toEqual({ main: 1, mainAgain: 2, nextYear: 1, noBranch: 1, noBranchAgain: 2 });
  });

  it('another school has its own numbers', async () => {
    const theirs = await other.actor('cashier');
    await as(cashier, (ctx) => nextValue(ctx, 'shared-key'));
    await as(cashier, (ctx) => nextValue(ctx, 'shared-key'));
    expect(await as(theirs, (ctx) => nextValue(ctx, 'shared-key'))).toBe(1);
  });

  it('a save that is rolled back gives its number back: no gap is left', async () => {
    const first = await as(cashier, (ctx) => nextValue(ctx, 'voucher'));
    await expect(
      as(cashier, async (ctx) => {
        await nextValue(ctx, 'voucher');
        throw new Error('the save failed');
      }),
    ).rejects.toThrow();
    expect(await as(cashier, (ctx) => nextValue(ctx, 'voucher'))).toBe(first + 1);
  });

  it('50 people saving at the same moment get 50 different, consecutive numbers', async () => {
    const taken = await Promise.all(
      Array.from({ length: 50 }, () => as(cashier, (ctx) => nextValue(ctx, 'busy-counter'))),
    );
    expect([...taken].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 50 }, (_unused, index) => index + 1),
    );
  });

  it('a family user’s action can take a number too', async () => {
    const guardian = await school.actor('guardian');
    expect(await as(guardian, (ctx) => nextNumber(ctx, 'complaint', { format: 'C-{0000}' }))).toBe(
      'C-0001',
    );
  });

  it('a faulty format takes no number', async () => {
    await expect(
      as(cashier, (ctx) => nextNumber(ctx, 'careful', { format: '{branch}-{0000}' })),
    ).rejects.toThrow(/branch/);
    expect(await as(cashier, (ctx) => nextValue(ctx, 'careful'))).toBe(1);
  });
});

describe('idempotency', () => {
  const request = (key: string, body: unknown = { amount: 12_500 }) => ({
    key,
    route: 'POST /fee-payments',
    requestHash: hashRequest('POST', '/fee-payments', body),
  });
  const collect = (key: string, body?: unknown) => {
    let runs = 0;
    const call = () =>
      as(cashier, (ctx) =>
        withIdempotency(ctx, request(key, body), async () => {
          runs += 1;
          await ctx.db.insert(rooms).values({
            orgId: school.orgId,
            branchId: school.mainBranchId,
            name: `Receipt ${randomUUID()}`,
          });
          return { status: 201, body: { receipt: `R-${key}` } };
        }),
      );
    return { call, runs: () => runs };
  };

  it('a double click runs the work once and returns the same answer twice', async () => {
    const key = randomUUID();
    const payment = collect(key);
    const first = await payment.call();
    const second = await payment.call();
    expect(first).toEqual({ status: 201, body: { receipt: `R-${key}` }, replayed: false });
    expect(second).toEqual({ status: 201, body: { receipt: `R-${key}` }, replayed: true });
    expect(payment.runs()).toBe(1);
  });

  it('the same key for a different request is refused', async () => {
    const key = randomUUID();
    await collect(key).call();
    const error = await expectError('CONFLICT', () => collect(key, { amount: 99 }).call());
    expect(error.message).toBe('This request key was already used for a different request.');
  });

  it('a request that failed stores nothing, so it can simply be tried again', async () => {
    const key = randomUUID();
    await expect(
      as(cashier, (ctx) =>
        withIdempotency(ctx, request(key), async () => {
          throw new Error('the gateway timed out');
        }),
      ),
    ).rejects.toThrow('the gateway timed out');
    const retry = await collect(key).call();
    expect(retry.replayed).toBe(false);
  });

  it('two identical requests at the same moment: one runs, the other gets its answer', async () => {
    const key = randomUUID();
    const payment = collect(key);
    const [a, b] = await Promise.all([payment.call(), payment.call()]);
    expect(payment.runs()).toBe(1);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    expect(a.body).toEqual(b.body);
  });

  it('a key belongs to one user: another user’s identical key is a different request', async () => {
    const key = randomUUID();
    await collect(key).call();
    const result = await as(principal, (ctx) =>
      withIdempotency(ctx, request(key), async () => ({ status: 200, body: 'mine' })),
    );
    expect(result).toEqual({ status: 200, body: 'mine', replayed: false });
  });

  it('a key is forgotten after a day, and expired keys are purged', async () => {
    const key = randomUUID();
    freezeTime('2026-10-10T06:00:00.000Z');
    await collect(key).call();
    freezeTime('2026-10-11T06:00:01.000Z');
    const later = collect(key);
    expect((await later.call()).replayed).toBe(false);
    expect(later.runs()).toBe(1);

    freezeTime('2026-10-13T00:00:00.000Z');
    expect(await purgeExpiredIdempotencyKeys('2026-10-13T00:00:00.000Z')).toBeGreaterThan(0);
    const left = await adminDb().select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key));
    expect(left).toEqual([]);
    freezeTime();
  });
});

describe('rate limits', () => {
  it('counts hits in a window and refuses the one over the limit, with the seconds to wait', async () => {
    freezeTime('2026-10-12T06:00:10.000Z');
    const key = `sign-in:${randomUUID()}`;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const result = await checkLimit({ key, max: 5, windowSeconds: 60 });
      expect(result).toMatchObject({ allowed: true, remaining: 5 - attempt });
    }
    const sixth = await checkLimit({ key, max: 5, windowSeconds: 60 });
    expect(sixth).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 50 });
    const error = await expectError('RATE_LIMITED', () =>
      limit({ key, max: 5, windowSeconds: 60 }),
    );
    expect(error.message).toMatch(/50 seconds/);
  });

  it('a new window starts the count again, and old windows are purged', async () => {
    const key = `otp:${randomUUID()}`;
    freezeTime('2026-10-12T06:00:59.000Z');
    await limit({ key, max: 1, windowSeconds: 60 });
    await expectError('RATE_LIMITED', () => limit({ key, max: 1, windowSeconds: 60 }));
    freezeTime('2026-10-12T06:01:00.000Z');
    await expect(limit({ key, max: 1, windowSeconds: 60 })).resolves.toBeUndefined();
    expect(await purgeRateLimits('2026-10-12T06:01:00.000Z')).toBeGreaterThan(0);
    freezeTime();
  });

  it('different keys do not share a count', async () => {
    const a = `x:${randomUUID()}`;
    const b = `x:${randomUUID()}`;
    await limit({ key: a, max: 1, windowSeconds: 600 });
    await expect(limit({ key: b, max: 1, windowSeconds: 600 })).resolves.toBeUndefined();
  });
});

describe('settings', () => {
  it('R-org-2: the branch value wins, then the organisation value, then the default', async () => {
    const start = await as(principal, (ctx) =>
      resolveSetting(ctx, generalWorkingWeek, school.mainBranchId),
    );
    expect(start).toEqual({
      value: { workingDays: [1, 2, 3, 4, 5, 6], shortDay: 5 },
      source: 'default',
    });

    await as(principal, (ctx) =>
      setSetting(ctx, generalWorkingWeek, { workingDays: [1, 2, 3, 4, 5], shortDay: 5 }),
    );
    await as(principal, (ctx) =>
      setSetting(
        ctx,
        generalWorkingWeek,
        { workingDays: [1, 2, 3, 4, 6], shortDay: null },
        school.mainBranchId,
      ),
    );

    const main = await as(principal, (ctx) =>
      resolveSetting(ctx, generalWorkingWeek, school.mainBranchId),
    );
    expect(main).toEqual({
      value: { workingDays: [1, 2, 3, 4, 6], shortDay: null },
      source: 'branch',
    });
    const owner = await school.actor('owner');
    const city = await as(owner, (ctx) =>
      resolveSetting(ctx, generalWorkingWeek, school.cityBranchId),
    );
    expect(city).toEqual({ value: { workingDays: [1, 2, 3, 4, 5], shortDay: 5 }, source: 'org' });

    await as(principal, (ctx) => clearBranchSetting(ctx, generalWorkingWeek, school.mainBranchId));
    expect(
      (await as(principal, (ctx) => resolveSetting(ctx, generalWorkingWeek, school.mainBranchId)))
        .source,
    ).toBe('org');
  });

  it('saving twice changes the one row and audits each change', async () => {
    await as(principal, (ctx) => setSetting(ctx, securitySessionHours, 24));
    await as(principal, (ctx) => setSetting(ctx, securitySessionHours, 48));
    expect(await as(principal, (ctx) => getSetting(ctx, securitySessionHours))).toBe(48);
    const rows = await adminDb()
      .select()
      .from(orgSettings)
      .where(eq(orgSettings.orgId, school.orgId));
    expect(rows.filter((row) => row.key === 'security.session_hours')).toHaveLength(1);
    const audits = await adminDb().select().from(auditLog).where(eq(auditLog.orgId, school.orgId));
    const sessionAudits = audits.filter(
      (entry) =>
        entry.entity === 'org-settings' && 'security.session_hours' in (entry.changes as object),
    );
    expect(
      sessionAudits.map(
        (entry) => (entry.changes as Record<string, unknown>)['security.session_hours'],
      ),
    ).toEqual([
      [168, 24],
      [24, 48],
    ]);
  });

  it('a value that does not fit the setting is refused with VALIDATION', async () => {
    await expectError('VALIDATION', () =>
      as(principal, (ctx) => setSetting(ctx, securitySessionHours, 100_000)),
    );
    await expectError('VALIDATION', () =>
      as(principal, (ctx) => setSetting(ctx, generalNumberFormats, { admission: '' })),
    );
  });

  it('an organisation-wide setting cannot be set for one branch', async () => {
    await expectError('RULE', () =>
      as(principal, (ctx) => setSetting(ctx, securitySessionHours, 24, school.mainBranchId)),
    );
  });

  it('R-org-1: a setting that is not in the catalogue can be neither read nor written', async () => {
    const stray = defineSetting({
      key: 'tests.unregistered',
      scope: 'org',
      schema: z.boolean(),
      default: false,
      label: 'Unregistered',
    });
    await expect(as(principal, (ctx) => getSetting(ctx, stray))).rejects.toThrow(
      /not in the catalogue/,
    );
    await expect(as(principal, (ctx) => setSetting(ctx, stray, true))).rejects.toThrow(
      /not in the catalogue/,
    );
  });

  it('a stored value that no longer fits its schema falls back instead of breaking the screen', async () => {
    await withAdminTx((tx) =>
      tx
        .update(orgSettings)
        .set({ value: 'not a number' as never })
        .where(eq(orgSettings.key, 'security.session_hours')),
    );
    expect(await as(principal, (ctx) => getSetting(ctx, securitySessionHours))).toBe(168);
  });

  it('a family user reads the school’s value too, and cannot change it', async () => {
    const guardian = await school.actor('guardian');
    await as(principal, (ctx) => setSetting(ctx, securitySessionHours, 72));
    expect(await as(guardian, (ctx) => getSetting(ctx, securitySessionHours))).toBe(72);
    // The service checks the permission; even without that check the database refuses the write.
    await expect(as(guardian, (ctx) => setSetting(ctx, securitySessionHours, 1))).rejects.toThrow();
    expect(await as(principal, (ctx) => getSetting(ctx, securitySessionHours))).toBe(72);
  });

  it('another school’s settings are its own', async () => {
    const theirs = await other.actor('principal');
    expect(await as(theirs, (ctx) => getSetting(ctx, securitySessionHours))).toBe(168);
  });
});

describe('modules', () => {
  it('core modules are always on; an optional one follows the organisation’s switches', async () => {
    const bare = await seedOrg({ modules: [] });
    const actor = await bare.actor('principal');
    await as(actor, async (ctx) => {
      await expect(assertModule(ctx, 'fees')).resolves.toBeUndefined();
      const enabled = await enabledModules(ctx);
      expect(enabled.has('students')).toBe(true);
      expect(enabled.has('transport')).toBe(false);
    });
    const error = await expectError('FORBIDDEN', () =>
      as(actor, (ctx) => assertModule(ctx, 'transport')),
    );
    expect(error.message).toBe('Transport is not part of your plan');

    await withAdminTx((tx) =>
      tx
        .insert(orgModules)
        .values({ orgId: bare.orgId, moduleKey: 'transport', isEnabled: true, source: 'override' }),
    );
    await expectError('FORBIDDEN', () => as(actor, (ctx) => assertModule(ctx, 'transport'))); // remembered for a minute
    invalidateModules(bare.orgId);
    await expect(as(actor, (ctx) => assertModule(ctx, 'transport'))).resolves.toBeUndefined();
  });

  it('a core module cannot be switched off by a stray row', async () => {
    const odd = await seedOrg({ modules: [] });
    await withAdminTx((tx) =>
      tx
        .insert(orgModules)
        .values({ orgId: odd.orgId, moduleKey: 'fees', isEnabled: false, source: 'override' }),
    );
    const actor = await odd.actor('accountant');
    await expect(as(actor, (ctx) => assertModule(ctx, 'fees'))).resolves.toBeUndefined();
  });
});
