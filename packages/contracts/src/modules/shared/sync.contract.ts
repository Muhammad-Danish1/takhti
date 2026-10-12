import { z } from 'zod';
import { QueryBool } from '../../kernel/primitives';
import { MAX_PAGE_SIZE } from '../../kernel/resource';
import { DevicePlatform } from '../identity/identity.constants';
import { SyncConflictStatus, SyncDeviceStatus, syncOpResults } from './shared.constants';

/*
 * The offline upload: docs/plan/00-foundation/14-offline-design.md ("The write path") and
 * docs/plan/10-modules/m00-shared-kernel.md, section 4.
 * A device sends the changes it queued while offline; the server answers for each one.
 */

/** The most operations one upload may carry. A device with more sends several uploads. */
export const MAX_SYNC_OPS = 500;

export const syncOpKinds = ['PUT', 'PATCH', 'DELETE'] as const;
export type SyncOpKind = (typeof syncOpKinds)[number];

export const SyncOp = z.object({
  /** Made by the device, once, for this change. Sending it again is harmless. */
  opId: z.string().min(8).max(100),
  /** The table as the device knows it: `attendance_records`. */
  table: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Not a table name'),
  /** `PUT` adds a row, `PATCH` changes one, `DELETE` removes one. */
  op: z.enum(syncOpKinds),
  /** The id of the row. For a new row the device made it. */
  id: z.uuid(),
  data: z.record(z.string(), z.unknown()).optional(),
  /** The version of the row the device last saw, for a change to an existing row. */
  baseVersion: z.int().min(1).optional(),
});
export type SyncOp = z.output<typeof SyncOp>;

export const SyncUpload = z.object({
  deviceId: z.uuid(),
  ops: z.array(SyncOp).min(1).max(MAX_SYNC_OPS),
});
export type SyncUpload = z.output<typeof SyncUpload>;

export const SyncOpOutcome = z.object({
  opId: z.string(),
  /**
   * `applied`: it is now a fact. `duplicate`: it was applied by an earlier upload.
   * `rejected`: the server said no; `code` and `message` say why, for the person to read.
   * `conflict`: the server's value was kept and the device's is waiting for someone to decide.
   */
  result: z.enum(syncOpResults),
  code: z.string().optional(),
  message: z.string().optional(),
});
export type SyncOpOutcome = z.output<typeof SyncOpOutcome>;

export const SyncUploadResult = z.object({
  /** True when the device was revoked: it must delete its local data. Nothing was applied. */
  wipe: z.boolean(),
  /** One for each operation sent, in the order sent. */
  results: z.array(SyncOpOutcome),
});
export type SyncUploadResult = z.output<typeof SyncUploadResult>;

// ---------------------------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------------------------

/** The letters and digits a device code is made of: none that is mistaken for another in print. */
export const DEVICE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Switching offline mode on registers the device. Sending the same `id` again is how a device
 * checks in: it reports its version and how much it still holds, and learns whether it was revoked.
 */
export const RegisterDevice = z.object({
  /** Made by the device, once, and kept. */
  id: z.uuid().optional(),
  /** What its owner calls it: "Office laptop". */
  name: z.string().trim().min(1, { error: 'Give this device a name' }).max(80),
  platform: DevicePlatform,
  appVersion: z.string().trim().min(1).max(40),
  /** How many changes are still waiting on the device. */
  pendingCount: z.int().min(0).max(1_000_000).optional(),
});
export type RegisterDevice = z.output<typeof RegisterDevice>;

export const SyncDevice = z.object({
  id: z.uuid(),
  createdAt: z.string(),
  userId: z.uuid(),
  /** Whose device it is. */
  userName: z.string().nullable(),
  /** Two characters, printed in the numbers of receipts issued offline. */
  deviceCode: z.string(),
  name: z.string(),
  platform: DevicePlatform,
  appVersion: z.string(),
  lastSyncAt: z.string().nullable(),
  /** Changes still waiting on the device, as it last reported. */
  pendingCount: z.int(),
  /** A revoked device must delete what it holds. */
  status: SyncDeviceStatus,
  revokedBy: z.uuid().nullable(),
});
export type SyncDevice = z.output<typeof SyncDevice>;

export const ListSyncDevices = z.strictObject({
  status: SyncDeviceStatus.optional(),
  userId: z.uuid().optional(),
  /** Only devices that still hold work the server has not seen. */
  pending: QueryBool.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});
export type ListSyncDevices = z.output<typeof ListSyncDevices>;

// ---------------------------------------------------------------------------------------------
// Refused changes
// ---------------------------------------------------------------------------------------------

/** A change the server refused, kept with its reason until the person who made it has dealt with it. */
export const SyncRejection = z.object({
  id: z.uuid(),
  createdAt: z.string(),
  deviceId: z.uuid(),
  opId: z.string(),
  tableName: z.string(),
  entityId: z.uuid(),
  /** What the device sent. */
  payload: z.unknown(),
  /** An API error code. */
  reasonCode: z.string(),
  /** Written for the person. */
  reason: z.string(),
  /** When they marked it as dealt with. */
  resolvedAt: z.string().nullable(),
});
export type SyncRejection = z.output<typeof SyncRejection>;

export const ListSyncRejections = z.strictObject({
  deviceId: z.uuid().optional(),
  /** Those already dealt with as well. */
  dismissed: QueryBool.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});
export type ListSyncRejections = z.output<typeof ListSyncRejections>;

// ---------------------------------------------------------------------------------------------
// Conflicts
// ---------------------------------------------------------------------------------------------

/** A device's value and the server's value disagree, and a person chooses. */
export const SyncConflictItem = z.object({
  id: z.uuid(),
  version: z.int(),
  createdAt: z.string(),
  deviceId: z.uuid(),
  deviceName: z.string().nullable(),
  /** Who made the change on the device. */
  userName: z.string().nullable(),
  tableName: z.string(),
  entityId: z.uuid(),
  deviceValue: z.unknown(),
  serverValue: z.unknown(),
  status: SyncConflictStatus,
  resolvedBy: z.uuid().nullable(),
  resolvedAt: z.string().nullable(),
});
export type SyncConflictItem = z.output<typeof SyncConflictItem>;

export const ListSyncConflicts = z.strictObject({
  /** Left out: the open ones. */
  status: SyncConflictStatus.optional(),
  tableName: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/, 'Not a table name')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});
export type ListSyncConflicts = z.output<typeof ListSyncConflicts>;

export const syncResolutions = ['keep_server', 'take_device'] as const;

export const ResolveSyncConflict = z.object({
  /** `keep_server`: what the server holds stands. `take_device`: the device's value is applied now. */
  resolution: z.enum(syncResolutions),
});
export type ResolveSyncConflict = z.output<typeof ResolveSyncConflict>;
