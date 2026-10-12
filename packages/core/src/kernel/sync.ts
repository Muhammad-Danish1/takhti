import { and, eq, isNull } from 'drizzle-orm';
import type {
  ModuleKey,
  SyncOp,
  SyncOpKind,
  SyncOpOutcome,
  SyncOpResult,
  SyncUpload,
  SyncUploadResult,
} from '@takhti/contracts';
import { syncConflicts, syncDevices, syncOps, syncRejections } from '@takhti/db';
import { stampOf, type Ctx } from './context';
import { findPostgresError, notFound, toErrorResponse } from './errors';
import { newId } from './ids';
import { isModuleEnabled } from './modules';

/*
 * The offline upload: docs/plan/00-foundation/14-offline-design.md ("The write path").
 *
 * A device queues changes while it has no connection and sends them when it has one. Each change
 * is a request, not a fact: it becomes a fact when the same service an online request would call
 * accepts it. This file is the registry of what may be written offline and the loop that applies
 * a batch.
 *
 * A module makes a table writable offline beside its service:
 *
 *   registerSyncTable({
 *     table: 'attendance_records', module: 'attendance', policy: 'latest-wins',
 *     apply: {
 *       PUT: (ctx, op) => attendanceService.markOne(ctx, AttendanceMark.parse({ id: op.id, ...op.data })),
 *     },
 *   });
 */

/**
 * What happens when a row changed on the server while a device was offline. Fixed for each table
 * by what the record is (14, "Conflicts"); the handler carries it out.
 */
export type ConflictPolicy =
  /** An observation (attendance, roll-call): the later write stands. */
  | 'latest-wins'
  /** A log or new information (a visitor, a diary entry): always added; a repeat is merged. */
  | 'always-add'
  /** A judgement (a mark): the server's value stays and the device's goes to a person to decide. */
  | 'server-wins'
  /** Money: never overwritten; the service turns a clash into credit and a review item. */
  | 'never-overwrite';

/** What a handler answers when it kept the server's value and set the device's aside. */
export interface SyncConflict {
  conflict: { deviceValue: unknown; serverValue: unknown };
}

/** Applies one operation through its service. What it returns is ignored, unless it is a `SyncConflict`. */
export type SyncApply = (ctx: Ctx, op: SyncOp) => Promise<unknown>;

/** A conflict a person is deciding. */
export interface WaitingConflict {
  id: string;
  entityId: string;
  deviceValue: unknown;
  serverValue: unknown;
}

export interface SyncTable {
  /** The table as devices name it. */
  table: string;
  module: ModuleKey;
  policy: ConflictPolicy;
  /** The operations a device may send for it. One that is missing is refused. */
  apply: Partial<Record<SyncOpKind, SyncApply>>;
  /**
   * Applies a device's value that was set aside, when a person chooses it over the server's:
   * through the module's service, as that person, so the module's rules decide whether they may.
   * A table without it can only keep the server's value.
   */
  takeDevice?: (ctx: Ctx, conflict: WaitingConflict) => Promise<unknown>;
}

const tables = new Map<string, SyncTable>();

export function registerSyncTable(definition: SyncTable): void {
  tables.set(definition.table, definition);
}

export const findSyncTable = (table: string): SyncTable | undefined => tables.get(table);
export const registeredSyncTables = (): SyncTable[] => [...tables.values()];

/** For tests: forgets a table registered by one. */
export function removeSyncTable(table: string): void {
  tables.delete(table);
}

/** For a handler: the server's value stays, the device's waits for a person to decide. */
export const syncConflict = (deviceValue: unknown, serverValue: unknown): SyncConflict => ({
  conflict: { deviceValue, serverValue },
});

const isConflict = (value: unknown): value is SyncConflict =>
  typeof value === 'object' && value !== null && 'conflict' in value;

class OpFailed extends Error {
  constructor(readonly original: unknown) {
    super('sync operation failed');
  }
}

/** Runs work in a savepoint. Whatever it wrote is undone if it throws; what came before stays. */
async function inSavepoint<T>(ctx: Ctx, work: (inner: Ctx) => Promise<T>): Promise<T> {
  try {
    return await ctx.db.transaction(async (savepoint) => {
      try {
        return await work({ ...ctx, db: savepoint });
      } catch (error) {
        throw new OpFailed(error);
      }
    });
  } catch (error) {
    throw error instanceof OpFailed ? error.original : error;
  }
}

const alreadyApplied = (error: unknown): boolean => {
  const pg = findPostgresError(error);
  return pg?.code === '23505' && pg.constraint === 'sync_ops_uq';
};

/** Notes that an operation was dealt with. No `returning`: a member writes this log but only staff read it. */
async function remember(
  ctx: Ctx,
  deviceId: string,
  op: SyncOp,
  result: Exclude<SyncOpResult, 'duplicate'>,
): Promise<void> {
  await ctx.db.insert(syncOps).values({
    id: newId(),
    orgId: ctx.actor.orgId,
    createdAt: ctx.now,
    createdBy: stampOf(ctx),
    deviceId,
    opId: op.opId,
    tableName: op.table,
    result,
  });
}

/**
 * Applies a device's queued changes, in order, each in its own savepoint.
 *
 * The answer always lists every operation: a change the server refuses must not block the ones
 * behind it (F-shared-8). Only an error nobody expected stops the batch; the route then answers
 * with a server error, nothing of the batch is kept, and the device sends it again later.
 */
export async function applySyncBatch(ctx: Ctx, upload: SyncUpload): Promise<SyncUploadResult> {
  const [device] = await ctx.db
    .select()
    .from(syncDevices)
    .where(
      and(
        eq(syncDevices.id, upload.deviceId),
        eq(syncDevices.userId, ctx.actor.userId),
        isNull(syncDevices.deletedAt),
      ),
    )
    .limit(1);
  // Somebody else's device is, to this person, not a device.
  if (!device) throw notFound('Device');
  // R-shared-13: a revoked device is told to delete what it holds, and nothing it sent is applied.
  if (device.status !== 'active') return { wipe: true, results: [] };

  const applying: Ctx = { ...ctx, source: 'sync', deviceId: device.id };
  const results: SyncOpOutcome[] = [];

  for (const op of upload.ops) {
    // R-shared-11: seen before. Staff can read the log; for anyone else the insert below is the guard.
    const [seen] = await ctx.db
      .select({ id: syncOps.id })
      .from(syncOps)
      .where(and(eq(syncOps.deviceId, device.id), eq(syncOps.opId, op.opId)))
      .limit(1);
    if (seen) {
      results.push({ opId: op.opId, result: 'duplicate' });
      continue;
    }

    const definition = tables.get(op.table);
    const handler = definition?.apply[op.op];
    let refusal: { code: string; message: string } | undefined;
    // R-shared-12: only what a module registered may be written offline.
    if (!definition || !handler)
      refusal = { code: 'FORBIDDEN', message: 'This cannot be changed while offline' };
    else if (!(await isModuleEnabled(ctx, definition.module)))
      refusal = { code: 'FORBIDDEN', message: 'This is not part of your plan' };

    if (!refusal && handler) {
      try {
        const outcome = await inSavepoint(applying, async (inner) => {
          const answer = await handler(inner, op);
          if (isConflict(answer)) {
            await inner.db.insert(syncConflicts).values({
              id: newId(),
              orgId: ctx.actor.orgId,
              createdAt: ctx.now,
              updatedAt: ctx.now,
              createdBy: stampOf(ctx),
              updatedBy: stampOf(ctx),
              deviceId: device.id,
              tableName: op.table,
              entityId: op.id,
              deviceValue: answer.conflict.deviceValue as never,
              serverValue: answer.conflict.serverValue as never,
            });
          }
          const result = isConflict(answer) ? 'conflict' : 'applied';
          // Inside the savepoint: if this operation was applied before, the insert is refused and
          // everything the handler just did is undone with it.
          await remember(inner, device.id, op, result);
          return result;
        });
        results.push({
          opId: op.opId,
          result: outcome,
          ...(outcome === 'conflict' && {
            message: 'This was changed by someone else while you were offline. Your version is waiting for a decision.',
          }),
        });
        continue;
      } catch (error) {
        if (alreadyApplied(error)) {
          results.push({ opId: op.opId, result: 'duplicate' });
          continue;
        }
        const reply = toErrorResponse(error, ctx.requestId);
        // A bug, or the database gone: nothing of this batch is kept and the device tries again.
        if (reply.unexpected) throw error;
        refusal = { code: reply.body.error.code, message: reply.body.error.message };
      }
    }

    // Nothing is silently lost: the refusal is kept, with what was sent, until the person deals with it.
    const reason = refusal as { code: string; message: string };
    try {
      await inSavepoint(ctx, async (inner) => {
        await remember(inner, device.id, op, 'rejected');
        await inner.db.insert(syncRejections).values({
          id: newId(),
          orgId: ctx.actor.orgId,
          createdAt: ctx.now,
          updatedAt: ctx.now,
          createdBy: stampOf(ctx),
          updatedBy: stampOf(ctx),
          userId: ctx.actor.userId,
          deviceId: device.id,
          opId: op.opId,
          tableName: op.table,
          entityId: op.id,
          payload: { op: op.op, data: op.data ?? null, baseVersion: op.baseVersion ?? null } as never,
          reasonCode: reason.code,
          reason: reason.message,
        });
      });
      results.push({ opId: op.opId, result: 'rejected', ...reason });
    } catch (error) {
      if (!alreadyApplied(error)) throw error;
      // Refused before, by an earlier upload: the person already has the reason.
      results.push({ opId: op.opId, result: 'duplicate' });
    }
  }

  await ctx.db
    .update(syncDevices)
    .set({ lastSyncAt: ctx.now, updatedAt: ctx.now })
    .where(eq(syncDevices.id, device.id));
  return { wipe: false, results };
}
