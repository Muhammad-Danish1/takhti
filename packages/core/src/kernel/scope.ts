import { inArray, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Ctx } from './context';
import { forbidden, rule } from './errors';

/*
 * Scoping that row-level security does not do, or that is worth stating twice.
 * Row-level security already keeps staff inside their branches and families to their own children;
 * these helpers give the same answers early, with a message a person can act on.
 *
 * Section and wing scoping for teachers (`teacherSectionIds`, `wingGradeIds`) live with the
 * academic tables they read, in the academics module.
 */

/** Whether the actor may work in this branch. */
export const hasBranch = (ctx: Ctx, branchId: string): boolean =>
  ctx.actor.allBranches || ctx.actor.branchIds.includes(branchId);

/** Throws `FORBIDDEN` when the actor has no access to the branch. */
export function assertBranch(ctx: Ctx, branchId: string): void {
  if (ctx.actor.kind === 'staff' || ctx.actor.kind === 'system') {
    if (!hasBranch(ctx, branchId)) throw forbidden('You do not have access to this branch');
  }
}

/**
 * A condition limiting a query to the branches the actor may see, or undefined when that is all of them.
 * With `ctx.branchId` set (the user picked a working branch) it narrows to that one.
 */
export function branchFilter(ctx: Ctx, column: AnyPgColumn): SQL | undefined {
  if (ctx.branchId) return sql`${column} = ${ctx.branchId}`;
  if (ctx.actor.kind !== 'staff' || ctx.actor.allBranches) return undefined;
  if (ctx.actor.branchIds.length === 0) return sql`false`;
  return inArray(column, [...ctx.actor.branchIds]);
}

/** The branch a new record goes into: the one given, else the one the user is working in, else their only one. */
export function resolveBranch(ctx: Ctx, branchId?: string | null): string {
  const chosen =
    branchId ??
    ctx.branchId ??
    (ctx.actor.branchIds.length === 1 ? ctx.actor.branchIds[0] : undefined);
  if (!chosen) throw rule('Choose a branch first');
  assertBranch(ctx, chosen);
  return chosen;
}

/** The staff record of whoever is acting, for a record that names the member of staff who made it. */
export function actorStaffId(ctx: Ctx): string {
  if (!ctx.actor.staffId) throw forbidden('Only a member of staff can do this');
  return ctx.actor.staffId;
}

/** A guardian or student acts only for their own children. Staff pass; their limits are permissions and sections. */
export function assertOwnStudent(ctx: Ctx, studentId: string): void {
  if (ctx.actor.kind === 'guardian' || ctx.actor.kind === 'student') {
    if (!ctx.actor.studentIds.includes(studentId))
      throw forbidden('This record belongs to another family');
  }
}

/** A person never approves, verifies or decides their own request. */
export function assertNotSelf(
  ctx: Ctx,
  userId: string | null | undefined,
  message = 'You cannot decide your own request',
): void {
  if (userId && ctx.actor.kind !== 'system' && userId === ctx.actor.userId) throw rule(message);
}

/** Whether the actor holds one of the given roles. For rules that name roles, such as approval steps. */
export const hasAnyRole = (ctx: Ctx, roleKeys: readonly string[]): boolean =>
  ctx.actor.kind === 'system' || ctx.actor.roleKeys.some((key) => roleKeys.includes(key));
