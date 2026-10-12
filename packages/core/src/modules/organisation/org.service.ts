import { and, eq, isNull } from 'drizzle-orm';
import { Org, OrgPublic, type UpdateOrg } from '@takhti/contracts';
import { files, orgs } from '@takhti/db';
import { audit } from '../../kernel/audit';
import { stampOf, type Ctx } from '../../kernel/context';
import { invalid, notFound, rule, stale } from '../../kernel/errors';
import { assertPermission } from '../../kernel/permissions';
import { fiscalCalendar } from '../accounting/fiscal-calendar';
import { academicYearsDb } from '../setup/academic-years.db-service';

/*
 * The school group's own row: docs/plan/10-modules/m02-organisation-branches.md.
 * Its slug and status belong to the platform; everything else is changed here.
 */

type OrgRow = typeof orgs.$inferSelect;

/**
 * Something that stops the way of billing from changing: vouchers of this month still open.
 * The module that owns the blocking records registers the check; it returns a sentence, or nothing.
 */
export type BillingModeBlocker = (ctx: Ctx) => Promise<string | undefined>;

const billingModeBlockers: BillingModeBlocker[] = [];

export function registerBillingModeBlocker(blocker: BillingModeBlocker): void {
  billingModeBlockers.push(blocker);
}

async function current(ctx: Ctx): Promise<OrgRow> {
  const [row] = await ctx.db
    .select()
    .from(orgs)
    .where(and(eq(orgs.id, ctx.actor.orgId), isNull(orgs.deletedAt)))
    .limit(1);
  if (!row) throw notFound('School');
  return row;
}

/** F-org-5: a logo that never finished uploading is refused by name, and the profile is saved without it. */
async function assertLogo(ctx: Ctx, fileId: string): Promise<void> {
  const [file] = await ctx.db
    .select({ status: files.status, mimeType: files.mimeType })
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
    .limit(1);
  if (!file) throw invalid({ logoFileId: ['Upload the logo again'] });
  if (file.status !== 'ready')
    throw invalid({ logoFileId: ['The logo has not finished uploading. Upload it again.'] });
  if (!file.mimeType.startsWith('image/'))
    throw invalid({ logoFileId: ['The logo must be an image'] });
}

export const orgService = {
  /** The group's profile, for staff. */
  async get(ctx: Ctx): Promise<Org> {
    assertPermission(ctx, 'org:read');
    return Org.parse(await current(ctx));
  },

  /** What a family's screens may know about the school: its name, its logo and how to reach it. */
  async publicProfile(ctx: Ctx): Promise<OrgPublic> {
    return OrgPublic.parse(await current(ctx));
  },

  async update(ctx: Ctx, input: UpdateOrg): Promise<Org> {
    assertPermission(ctx, 'org:update');
    const before = await current(ctx);
    const { version, ...given } = input;
    // A key that is present but undefined means "leave this alone", as in every PATCH.
    const changes = Object.fromEntries(
      Object.entries(given).filter(([, value]) => value !== undefined),
    ) as Partial<Omit<UpdateOrg, 'version'>>;

    // R-org-7: every voucher of the month was made one way; the other way starts with a clean month.
    if (changes.billingMode !== undefined && changes.billingMode !== before.billingMode) {
      const reasons = (await Promise.all(billingModeBlockers.map((blocker) => blocker(ctx)))).filter(
        (reason): reason is string => Boolean(reason),
      );
      if (reasons.length > 0)
        throw rule(`The way of billing cannot change yet: ${reasons.join('; ')}`);
    }

    // R-org-8: the month the academic year starts in is only a default for the first year.
    if (
      changes.academicYearStartMonth !== undefined &&
      changes.academicYearStartMonth !== before.academicYearStartMonth &&
      (await academicYearsDb.exists(ctx))
    )
      throw rule(
        'The month the academic year starts in cannot change once an academic year exists. Set the dates of each new year in school setup.',
      );

    // R-org-8: the fiscal month moves only while the first fiscal year is untouched.
    const movesFiscalYear =
      changes.fiscalYearStartMonth !== undefined &&
      changes.fiscalYearStartMonth !== before.fiscalYearStartMonth;
    if (movesFiscalYear && !(await fiscalCalendar.untouched(ctx)))
      throw rule(
        'The month the fiscal year starts in cannot change now: the fiscal year is already in use',
      );

    if (changes.logoFileId && changes.logoFileId !== before.logoFileId)
      await assertLogo(ctx, changes.logoFileId);

    const [after] = await ctx.db
      .update(orgs)
      .set({
        ...changes,
        version: before.version + 1,
        updatedAt: ctx.now,
        updatedBy: stampOf(ctx),
      })
      // F-org-4: two people saving the profile at once; the second is told to reload.
      .where(and(eq(orgs.id, before.id), eq(orgs.version, version)))
      .returning();
    if (!after) throw stale('The school profile');

    if (movesFiscalYear) await fiscalCalendar.rebuild(ctx, after.fiscalYearStartMonth);
    await audit(ctx, 'org', 'update', before.id, {
      before,
      after,
      summary: 'Changed the school profile',
    });
    return Org.parse(after);
  },
};
