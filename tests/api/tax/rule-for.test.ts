import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TaxRuleKind } from '@takhti/contracts';
import { taxService, type Actor } from '@takhti/core';
import { adminDb, taxRules } from '@takhti/db';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, expectError, seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

/*
 * Finding the rule a calculation must use: docs/plan/10-modules/m25-tax-compliance.md.
 *
 * EVERY FIGURE IN THIS FILE IS INVENTED FOR TESTING. None is a real rate, slab or threshold.
 */

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let payroll: Actor;

interface NewRule {
  kind: TaxRuleKind;
  name: string;
  from: string;
  to?: string;
  province?: string;
  status?: 'draft' | 'confirmed' | 'retired';
  params: unknown;
}

async function addRule(org: TestOrg, rule: NewRule): Promise<string> {
  const id = randomUUID();
  await adminDb()
    .insert(taxRules)
    .values({
      id,
      orgId: org.orgId,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
      kind: rule.kind,
      name: rule.name,
      province: rule.province ?? null,
      effectiveFrom: rule.from,
      effectiveTo: rule.to ?? null,
      params: rule.params,
      sourceNote: 'INVENTED FIGURES FOR A TEST. Not for production.',
      status: rule.status ?? 'confirmed',
    });
  return id;
}

const slabsOf = (percent: number) => ({
  slabs: [{ lower: 0, upTo: null, fixed: 0, percentOverLower: percent }],
});
const security = (percent: number) => ({
  wageCeiling: 50_000,
  employerPercent: percent,
  aboveCeiling: 'not_covered',
});

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  other = await seedOrg();
  payroll = await school.actor('payroll_officer');
});
afterAll(async () => {
  await db.destroy();
});

describe('T-tax-5 taxService.ruleFor', () => {
  it('picks the confirmed rule whose dates hold the day, with its figures read by the shape of its kind', async () => {
    const last = await addRule(school, {
      kind: 'salary_tax',
      name: 'Salary tax, tax year 2026',
      from: '2025-07-01',
      to: '2026-06-30',
      params: slabsOf(5),
    });
    const current = await addRule(school, {
      kind: 'salary_tax',
      name: 'Salary tax, tax year 2027',
      from: '2026-07-01',
      to: '2027-06-30',
      params: slabsOf(6),
    });

    const [june, july, lastDay] = await as(payroll, async (ctx) => [
      await taxService.ruleFor(ctx, 'salary_tax', '2026-06-30'),
      await taxService.ruleFor(ctx, 'salary_tax', '2026-07-01'),
      await taxService.ruleFor(ctx, 'salary_tax', '2027-06-30'),
    ]);
    expect(june?.id).toBe(last);
    expect(july).toMatchObject({
      id: current,
      kind: 'salary_tax',
      name: 'Salary tax, tax year 2027',
      effectiveFrom: '2026-07-01',
      effectiveTo: '2027-06-30',
    });
    expect(july?.params.slabs[0]?.percentOverLower).toBe(6);
    expect(lastDay?.id).toBe(current);
  });

  it('R-tax-3 / F-tax-1 refuses when no confirmed rule covers the day, naming the kind and the date', async () => {
    const error = await expectError('RULE', () =>
      as(payroll, (ctx) => taxService.ruleFor(ctx, 'salary_tax', '2027-07-31')),
    );
    expect(error.message).toContain('No confirmed salary tax rule covers 31 July 2027');
  });

  it('R-tax-1 never uses a draft or a retired rule', async () => {
    await addRule(school, {
      kind: 'eobi',
      name: 'EOBI draft',
      from: '2026-01-01',
      status: 'draft',
      params: { wageBase: 40_000, employeePercent: 1, employerPercent: 5 },
    });
    await addRule(school, {
      kind: 'eobi',
      name: 'EOBI retired',
      from: '2026-01-01',
      status: 'retired',
      params: { wageBase: 40_000, employeePercent: 1, employerPercent: 5 },
    });
    const error = await expectError('RULE', () =>
      as(payroll, (ctx) => taxService.ruleFor(ctx, 'eobi', '2026-10-12')),
    );
    expect(error.message).toContain('No confirmed EOBI rule covers 12 October 2026');
  });

  it('a rule with no end date stays in force', async () => {
    const id = await addRule(school, {
      kind: 'minimum_wage',
      name: 'Minimum wage',
      from: '2026-07-01',
      params: { monthly: 40_000 },
    });
    const found = await as(payroll, (ctx) => taxService.ruleFor(ctx, 'minimum_wage', '2031-01-01'));
    expect(found).toMatchObject({ id, params: { monthly: 40_000 } });
  });

  it('F-tax-8 with a province it picks that province’s rule, then one for the whole country, and never another province’s', async () => {
    const punjab = await addRule(school, {
      kind: 'social_security',
      name: 'Social security, Punjab',
      from: '2026-07-01',
      province: 'punjab',
      params: security(6),
    });
    await addRule(school, {
      kind: 'social_security',
      name: 'Social security, Sindh',
      from: '2026-07-01',
      province: 'sindh',
      params: security(7),
    });
    const [forPunjab, forSindh] = await as(payroll, async (ctx) => [
      await taxService.ruleFor(ctx, 'social_security', '2026-10-12', 'punjab'),
      await taxService.ruleFor(ctx, 'social_security', '2026-10-12', 'sindh'),
    ]);
    expect(forPunjab?.id).toBe(punjab);
    expect(forSindh?.params.employerPercent).toBe(7);

    // No rule for Khyber Pakhtunkhwa and none for the whole country: reported, not replaced.
    const error = await expectError('RULE', () =>
      as(payroll, (ctx) => taxService.ruleFor(ctx, 'social_security', '2026-10-12', 'kp')),
    );
    expect(error.message).toContain(
      'No confirmed social security rule for Khyber Pakhtunkhwa covers 12 October 2026',
    );

    const national = await addRule(school, {
      kind: 'social_security',
      name: 'Social security, everywhere else',
      from: '2026-07-01',
      params: security(5),
    });
    const [forKp, stillPunjab] = await as(payroll, async (ctx) => [
      await taxService.ruleFor(ctx, 'social_security', '2026-10-12', 'kp'),
      await taxService.ruleFor(ctx, 'social_security', '2026-10-12', 'punjab'),
    ]);
    expect(forKp?.id).toBe(national);
    expect(stillPunjab?.id).toBe(punjab);
  });

  it('a confirmed rule whose figures cannot be read stops the calculation rather than guess', async () => {
    await addRule(school, {
      kind: 'provident_fund',
      name: 'Provident fund',
      from: '2026-07-01',
      params: { employeePercent: 8 },
    });
    const error = await expectError('RULE', () =>
      as(payroll, (ctx) => taxService.ruleFor(ctx, 'provident_fund', '2026-10-12')),
    );
    expect(error.message).toContain('"Provident fund" has figures that cannot be read');
  });

  it('one school’s rules are never used for another', async () => {
    await addRule(other, {
      kind: 'fee_advance_tax',
      name: 'Advance tax on fees',
      from: '2026-07-01',
      params: {
        enabled: true,
        annualThreshold: 200_000,
        percent: 5,
        appliesTo: 'non_filers',
        countHeads: 'flagged',
      },
    });
    await expectError('RULE', () =>
      as(payroll, (ctx) => taxService.ruleFor(ctx, 'fee_advance_tax', '2026-10-12')),
    );
  });
});
