import type { Ctx } from './context';

/*
 * Who may see and change a record, asked by its kind.
 *
 * Files, notes and attachments hang on "any record": a student, a voucher, a staff member. The
 * shared services that keep them cannot know each module's rules, so each kind of record answers
 * for itself here:
 *
 *   registerRecordAccess('students', {
 *     canRead: (ctx, id) => studentsService.canOpen(ctx, id),
 *     canUpdate: (ctx, id) => studentsService.canChange(ctx, id),
 *   });
 *
 * Every plain resource is registered by `createCrudService` under its resource name: it may be read
 * by whoever holds its read permission and can reach the row, and changed by whoever holds its
 * update permission. A resource with finer rules registers again and replaces that.
 *
 * A kind nobody registered may be neither read nor changed through the shared services.
 */

export interface RecordAccess {
  /** Whether the person may open this record. False, never an error, when it does not exist for them. */
  canRead(ctx: Ctx, entityId: string): Promise<boolean>;
  /** Whether the person may change this record. */
  canUpdate(ctx: Ctx, entityId: string): Promise<boolean>;
}

const registry = new Map<string, RecordAccess>();

export function registerRecordAccess(entityType: string, access: RecordAccess): void {
  registry.set(entityType, access);
}

export const findRecordAccess = (entityType: string): RecordAccess | undefined =>
  registry.get(entityType);

/** Whether the person may open a record of the given kind. An unknown kind is closed to everyone. */
export async function canReadRecord(ctx: Ctx, entityType: string, entityId: string): Promise<boolean> {
  return (await registry.get(entityType)?.canRead(ctx, entityId)) ?? false;
}

/** Whether the person may change a record of the given kind. An unknown kind is closed to everyone. */
export async function canUpdateRecord(
  ctx: Ctx,
  entityType: string,
  entityId: string,
): Promise<boolean> {
  return (await registry.get(entityType)?.canUpdate(ctx, entityId)) ?? false;
}
