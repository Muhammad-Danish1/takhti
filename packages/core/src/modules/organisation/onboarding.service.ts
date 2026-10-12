import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  onboardingTaskKeys,
  type CompleteOnboardingTask,
  type OnboardingTask,
  type OnboardingTaskKey,
} from '@takhti/contracts';
import { onboardingTasks, orgs } from '@takhti/db';
import { audit } from '../../kernel/audit';
import { stampOf, type Ctx } from '../../kernel/context';
import { newId } from '../../kernel/ids';
import { assertPermission } from '../../kernel/permissions';
import { gradesDb } from '../academics/grades.db-service';
import { sectionsDb } from '../academics/sections.db-service';
import { subjectsDb } from '../academics/subjects.db-service';
import { feeGenerationRunsDb } from '../fees/fee-generation-runs.db-service';
import { feeStructuresDb } from '../fees/fee-structures.db-service';
import { academicYearsDb } from '../setup/academic-years.db-service';
import { staffDb } from '../staff/staff.db-service';
import { studentsDb } from '../students/students.db-service';

/*
 * The setup checklist a new school works through: docs/plan/10-modules/m02-organisation-branches.md.
 * A task is ticked by a person (done, or skipped). Beside each tick the list says whether the
 * system can already see the thing exists, so the screen can offer "mark as done" or point at
 * what is still missing.
 */

type Detector = (ctx: Ctx) => Promise<boolean>;

/** What the system can see for itself. Each looks only at what the person asking may read. */
const detectors: Record<OnboardingTaskKey, Detector> = {
  // A profile is filled in once the school can be found and reached.
  profile: async (ctx) => {
    const [org] = await ctx.db
      .select({ address: orgs.address, phone: orgs.phone })
      .from(orgs)
      .where(eq(orgs.id, ctx.actor.orgId))
      .limit(1);
    return Boolean(org?.address && org.phone);
  },
  academic_year: (ctx) => academicYearsDb.exists(ctx),
  grades: (ctx) => gradesDb.exists(ctx),
  sections: (ctx) => sectionsDb.exists(ctx),
  subjects: (ctx) => subjectsDb.exists(ctx),
  fee_structure: (ctx) => feeStructuresDb.exists(ctx),
  // The person who set the school up is on the staff list already; the task is to add the others.
  staff: async (ctx) => (await staffDb.count(ctx)) > 1,
  students: (ctx) => studentsDb.exists(ctx),
  first_voucher_run: (ctx) => feeGenerationRunsDb.exists(ctx),
};

async function rows(ctx: Ctx) {
  return ctx.db.select().from(onboardingTasks).where(isNull(onboardingTasks.deletedAt));
}

export const onboardingService = {
  /** The checklist, in its fixed order, with what was ticked and what the system can already see. */
  async list(ctx: Ctx): Promise<OnboardingTask[]> {
    assertPermission(ctx, 'org:read');
    const ticked = new Map((await rows(ctx)).map((row) => [row.key, row]));
    const tasks: OnboardingTask[] = [];
    for (const key of onboardingTaskKeys) {
      const row = ticked.get(key);
      tasks.push({
        key,
        status: row?.status ?? 'pending',
        completedAt: row?.completedAt ?? null,
        detected: await detectors[key](ctx),
      });
    }
    return tasks;
  },

  /** Ticks a task off, as done or as skipped. Ticking again changes the tick. */
  async complete(
    ctx: Ctx,
    key: OnboardingTaskKey,
    input: CompleteOnboardingTask,
  ): Promise<OnboardingTask> {
    assertPermission(ctx, 'onboarding:update');
    const stamp = { updatedAt: ctx.now, updatedBy: stampOf(ctx) };
    const done = { status: input.status, completedAt: ctx.now, completedBy: ctx.actor.userId };
    const [existing] = await ctx.db
      .select()
      .from(onboardingTasks)
      .where(and(eq(onboardingTasks.key, key), isNull(onboardingTasks.deletedAt)))
      .limit(1);
    let id = existing?.id;
    if (existing) {
      await ctx.db
        .update(onboardingTasks)
        .set({ ...done, version: sql`${onboardingTasks.version} + 1`, ...stamp })
        .where(eq(onboardingTasks.id, existing.id));
    } else {
      // A school made before a task was added to the list has no row for it yet.
      id = newId();
      await ctx.db.insert(onboardingTasks).values({
        id,
        orgId: ctx.actor.orgId,
        key,
        createdAt: ctx.now,
        createdBy: stampOf(ctx),
        ...done,
        ...stamp,
      });
    }
    await audit(ctx, 'onboarding', 'complete', id as string, {
      ...(existing && { before: { status: existing.status } }),
      after: { status: input.status },
      summary:
        input.status === 'done'
          ? `Marked the setup task "${key}" as done`
          : `Skipped the setup task "${key}"`,
    });
    return {
      key,
      status: input.status,
      completedAt: ctx.now,
      detected: await detectors[key](ctx),
    };
  },
};
