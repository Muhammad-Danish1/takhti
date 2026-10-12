import { and, count, desc, eq, gt, inArray, isNull, type SQL } from 'drizzle-orm';
import {
  DEVICE_CODE_ALPHABET,
  SyncConflictItem,
  SyncDevice,
  SyncRejection,
  type ListSyncConflicts,
  type ListSyncDevices,
  type ListSyncRejections,
  type Page,
  type RegisterDevice,
  type ResolveSyncConflict,
} from '@takhti/contracts';
import { profiles, syncConflicts, syncDevices, syncRejections } from '@takhti/db';
import { audit } from '../../kernel/audit';
import { stampOf, type Ctx } from '../../kernel/context';
import { randomCode } from '../../kernel/crypto';
import { findPostgresError, notFound, rule } from '../../kernel/errors';
import { newId } from '../../kernel/ids';
import { assertPermission } from '../../kernel/permissions';
import { findSyncTable } from '../../kernel/sync';

/*
 * The devices that work offline, the changes the server refused from them and the conflicts a
 * person must decide: docs/plan/10-modules/m00-shared-kernel.md and
 * docs/plan/00-foundation/14-offline-design.md ("Devices", "Conflicts").
 * The upload itself is `applySyncBatch` in the kernel.
 */

type DeviceRow = typeof syncDevices.$inferSelect;
type ConflictRow = typeof syncConflicts.$inferSelect;

/** A school has 1,024 codes. This many tries find a free one until nearly all are taken. */
const CODE_TRIES = 40;

class CodeTaken extends Error {}

async function namesOf(ctx: Ctx, userIds: readonly (string | null)[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => id !== null))];
  if (ids.length === 0) return new Map();
  const rows = await ctx.db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(inArray(profiles.id, ids));
  return new Map(rows.map((row) => [row.id, row.fullName]));
}

const toDevice = (row: DeviceRow, names: Map<string, string>): SyncDevice =>
  SyncDevice.parse({ ...row, userName: names.get(row.userId) ?? null });

async function page<T>(
  ctx: Ctx,
  table: typeof syncDevices | typeof syncRejections | typeof syncConflicts,
  where: SQL | undefined,
  query: { page: number; pageSize: number },
  items: T[],
): Promise<Page<T>> {
  const [counted] = await ctx.db.select({ total: count() }).from(table).where(where);
  return { items, page: query.page, pageSize: query.pageSize, total: counted?.total ?? 0 };
}

export const syncDevicesService = {
  /**
   * Switches offline mode on for a device, or checks one in. A new device is given a code of two
   * characters that no other device of the school has: receipts it issues offline carry it.
   */
  async register(ctx: Ctx, input: RegisterDevice): Promise<SyncDevice> {
    const names = await namesOf(ctx, [ctx.actor.userId]);
    if (input.id) {
      const [known] = await ctx.db
        .select()
        .from(syncDevices)
        .where(and(eq(syncDevices.id, input.id), isNull(syncDevices.deletedAt)))
        .limit(1);
      if (known) {
        // Somebody else's device is, to this person, not a device.
        if (known.userId !== ctx.actor.userId) throw notFound('Device');
        // A revoked device learns it here and deletes what it holds. Nothing about it changes.
        if (known.status !== 'active') return toDevice(known, names);
        const [row] = await ctx.db
          .update(syncDevices)
          .set({
            name: input.name,
            appVersion: input.appVersion,
            ...(input.pendingCount !== undefined && { pendingCount: input.pendingCount }),
            updatedAt: ctx.now,
            updatedBy: stampOf(ctx),
          })
          .where(eq(syncDevices.id, known.id))
          .returning();
        return toDevice(row as DeviceRow, names);
      }
    }

    const id = input.id ?? newId();
    for (let attempt = 0; attempt < CODE_TRIES; attempt++) {
      const deviceCode = randomCode(2, DEVICE_CODE_ALPHABET);
      try {
        // A savepoint, so that a code already taken costs only this one try.
        const row = await ctx.db.transaction(async (savepoint) => {
          try {
            const [inserted] = await savepoint
              .insert(syncDevices)
              .values({
                id,
                orgId: ctx.actor.orgId,
                createdAt: ctx.now,
                updatedAt: ctx.now,
                createdBy: stampOf(ctx),
                updatedBy: stampOf(ctx),
                userId: ctx.actor.userId,
                deviceCode,
                name: input.name,
                platform: input.platform,
                appVersion: input.appVersion,
                pendingCount: input.pendingCount ?? 0,
              })
              .returning();
            return inserted as DeviceRow;
          } catch (error) {
            const pg = findPostgresError(error);
            if (pg?.code === '23505' && pg.constraint === 'sync_devices_code_uq') throw new CodeTaken();
            // The id is that of a device this person cannot see: another family's, another school's.
            if (pg?.code === '23505' && pg.constraint === 'sync_devices_pkey') throw notFound('Device');
            throw error;
          }
        });
        await audit(ctx, 'sync-devices', 'register', row.id, {
          after: row,
          summary: `Switched offline mode on for ${row.name} (${row.deviceCode})`,
        });
        return toDevice(row, names);
      } catch (error) {
        if (!(error instanceof CodeTaken)) throw error;
      }
    }
    throw rule(
      'The school has no device code left to give. Ask an administrator to remove devices that are no longer used.',
    );
  },

  /** Every device of the school with offline mode on: those holding unsynced work first, the longest silent on top. */
  async list(ctx: Ctx, query: ListSyncDevices): Promise<Page<SyncDevice>> {
    assertPermission(ctx, 'sync-devices:read');
    const where = and(
      isNull(syncDevices.deletedAt),
      query.status ? eq(syncDevices.status, query.status) : undefined,
      query.userId ? eq(syncDevices.userId, query.userId) : undefined,
      query.pending === undefined
        ? undefined
        : query.pending
          ? gt(syncDevices.pendingCount, 0)
          : eq(syncDevices.pendingCount, 0),
    );
    const rows = await ctx.db
      .select()
      .from(syncDevices)
      .where(where)
      .orderBy(desc(gt(syncDevices.pendingCount, 0)), syncDevices.lastSyncAt, desc(syncDevices.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const names = await namesOf(ctx, rows.map((row) => row.userId));
    return page(ctx, syncDevices, where, query, rows.map((row) => toDevice(row, names)));
  },

  /** R-shared-13: from now on the device's uploads are refused and it is told to delete what it holds. */
  async revoke(ctx: Ctx, id: string): Promise<SyncDevice> {
    assertPermission(ctx, 'sync-devices:update');
    const [current] = await ctx.db
      .select()
      .from(syncDevices)
      .where(and(eq(syncDevices.id, id), isNull(syncDevices.deletedAt)))
      .limit(1)
      .for('update');
    if (!current) throw notFound('Device');
    const names = await namesOf(ctx, [current.userId]);
    if (current.status === 'revoked') return toDevice(current, names);
    const [row] = await ctx.db
      .update(syncDevices)
      .set({
        status: 'revoked',
        revokedBy: ctx.actor.userId,
        version: current.version + 1,
        updatedAt: ctx.now,
        updatedBy: stampOf(ctx),
      })
      .where(eq(syncDevices.id, id))
      .returning();
    await audit(ctx, 'sync-devices', 'revoke', id, {
      before: current,
      after: row as DeviceRow,
      summary: `Revoked the device ${current.name} (${current.deviceCode})`,
    });
    return toDevice(row as DeviceRow, names);
  },
};

export const syncRejectionsService = {
  /** One's own refused changes, newest first: those not yet dealt with, unless all are asked for. */
  async list(ctx: Ctx, query: ListSyncRejections): Promise<Page<SyncRejection>> {
    const where = and(
      eq(syncRejections.userId, ctx.actor.userId),
      isNull(syncRejections.deletedAt),
      query.dismissed ? undefined : isNull(syncRejections.resolvedAt),
      query.deviceId ? eq(syncRejections.deviceId, query.deviceId) : undefined,
    );
    const rows = await ctx.db
      .select()
      .from(syncRejections)
      .where(where)
      .orderBy(desc(syncRejections.createdAt), desc(syncRejections.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return page(ctx, syncRejections, where, query, rows.map((row) => SyncRejection.parse(row)));
  },

  /** Marks one as dealt with: the person has read why it was refused and done what they chose to. */
  async dismiss(ctx: Ctx, id: string): Promise<SyncRejection> {
    const [current] = await ctx.db
      .select()
      .from(syncRejections)
      .where(
        and(
          eq(syncRejections.id, id),
          eq(syncRejections.userId, ctx.actor.userId),
          isNull(syncRejections.deletedAt),
        ),
      )
      .limit(1);
    if (!current) throw notFound('Refused change');
    if (current.resolvedAt) return SyncRejection.parse(current);
    const [row] = await ctx.db
      .update(syncRejections)
      .set({
        resolvedAt: ctx.now,
        version: current.version + 1,
        updatedAt: ctx.now,
        updatedBy: stampOf(ctx),
      })
      .where(eq(syncRejections.id, id))
      .returning();
    return SyncRejection.parse(row);
  },
};

async function toConflicts(ctx: Ctx, rows: readonly ConflictRow[]): Promise<SyncConflictItem[]> {
  const deviceIds = [...new Set(rows.map((row) => row.deviceId))];
  const devices =
    deviceIds.length === 0
      ? []
      : await ctx.db
          .select({ id: syncDevices.id, name: syncDevices.name, userId: syncDevices.userId })
          .from(syncDevices)
          .where(inArray(syncDevices.id, deviceIds));
  const deviceOf = new Map(devices.map((device) => [device.id, device]));
  const names = await namesOf(ctx, devices.map((device) => device.userId));
  return rows.map((row) => {
    const device = deviceOf.get(row.deviceId);
    return SyncConflictItem.parse({
      ...row,
      deviceName: device?.name ?? null,
      userName: device ? (names.get(device.userId) ?? null) : null,
    });
  });
}

export const syncConflictsService = {
  /** The conflicts waiting for a decision, oldest first; or those already decided, when asked for. */
  async list(ctx: Ctx, query: ListSyncConflicts): Promise<Page<SyncConflictItem>> {
    assertPermission(ctx, 'sync-conflicts:update');
    const where = and(
      isNull(syncConflicts.deletedAt),
      eq(syncConflicts.status, query.status ?? 'open'),
      query.tableName ? eq(syncConflicts.tableName, query.tableName) : undefined,
    );
    const rows = await ctx.db
      .select()
      .from(syncConflicts)
      .where(where)
      .orderBy(syncConflicts.createdAt, syncConflicts.id)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return page(ctx, syncConflicts, where, query, await toConflicts(ctx, rows));
  },

  /**
   * Decides a conflict. Keeping the server's value changes nothing but the conflict. Taking the
   * device's value hands it to the module the record belongs to, which applies it by its own
   * rules as the person deciding; if it refuses, the conflict stays open and they are told why.
   */
  async resolve(ctx: Ctx, id: string, input: ResolveSyncConflict): Promise<SyncConflictItem> {
    assertPermission(ctx, 'sync-conflicts:update');
    const [current] = await ctx.db
      .select()
      .from(syncConflicts)
      .where(and(eq(syncConflicts.id, id), isNull(syncConflicts.deletedAt)))
      .limit(1)
      .for('update');
    if (!current) throw notFound('Conflict');
    if (current.status !== 'open') throw rule('This conflict has already been decided');

    if (input.resolution === 'take_device') {
      const takeDevice = findSyncTable(current.tableName)?.takeDevice;
      if (!takeDevice)
        throw rule(
          'The value from the device cannot be applied from here. Keep the server’s value and correct the record itself.',
        );
      await takeDevice(ctx, {
        id: current.id,
        entityId: current.entityId,
        deviceValue: current.deviceValue,
        serverValue: current.serverValue,
      });
    }

    const status = input.resolution === 'take_device' ? 'took_device' : 'kept_server';
    const [row] = await ctx.db
      .update(syncConflicts)
      .set({
        status,
        resolvedBy: ctx.actor.userId,
        resolvedAt: ctx.now,
        version: current.version + 1,
        updatedAt: ctx.now,
        updatedBy: stampOf(ctx),
      })
      .where(eq(syncConflicts.id, id))
      .returning();
    await audit(ctx, 'sync-conflicts', 'resolve', id, {
      before: current,
      after: row as ConflictRow,
      summary:
        status === 'took_device'
          ? `Took the device's value for a ${current.tableName} record`
          : `Kept the server's value for a ${current.tableName} record`,
    });
    return (await toConflicts(ctx, [row as ConflictRow]))[0] as SyncConflictItem;
  },
};
