import { AsyncLocalStorage } from 'node:async_hooks';
import {
  capabilities,
  type ActorKind,
  type Capability,
  type ChangeSource,
  type Locale,
} from '@takhti/contracts';
import { platformAuditLog, withAdminTx, withUserTx, type DbClaims, type Tx } from '@takhti/db';
import { nowIso, todayPk } from './dates';
import { newId, newRequestId } from './ids';
import { childLogger, type Logger } from './logger';

/*
 * `ctx` is the first argument of every db-service and service function. It carries the open
 * transaction, so any set of calls made with the same `ctx` succeeds or fails together.
 *
 * Three ways to get one:
 *   runAs          a signed-in member of a school, inside row-level security
 *   runAsSystem    a background job working for one school, inside row-level security
 *   runAsPlatform  Takhti's own staff, on the privileged connection, always recorded
 */

/** Who is acting. Built once per request by `authenticate()`, from the database, never from the token. */
export interface Actor {
  userId: string;
  /** The school group. */
  orgId: string;
  membershipId: string;
  kind: ActorKind;
  roleKeys: readonly string[];
  /** Granted `resource:action` pairs, for example `students:create`. */
  permissions: ReadonlySet<string>;
  /** True for group-level staff, who see every branch. */
  allBranches: boolean;
  branchIds: readonly string[];
  staffId?: string;
  guardianId?: string;
  /** A guardian's children, or the student themself. */
  studentIds: readonly string[];
  familyId?: string;
  /** Flags for the sensitive tables that row-level security also guards. */
  caps: readonly Capability[];
  locale: Locale;
  /** On platform routes: which of Takhti's own roles the admin holds. */
  platformRole?: 'super_admin' | 'support_agent';
  /** Set while Takhti staff work inside a school through a support session. */
  supportSessionId?: string;
}

export interface Ctx {
  db: Tx;
  actor: Actor;
  /** Printed in logs, saved in the audit log and returned with errors. */
  requestId: string;
  /** Who is calling: an API route, the offline sync upload, a background job or an AI tool. */
  source: ChangeSource;
  /** The moment this unit of work started, as ISO text. The same value for its whole length. */
  now: string;
  /** The calendar date in Pakistan at `now`. */
  today: string;
  /** Already tagged with the request, the organisation and the user. */
  log: Logger;
  /** The branch the user is working in, when they chose one. Already checked against their access. */
  branchId?: string;
  ip?: string;
  userAgent?: string;
  /** The offline device a synced change came from. */
  deviceId?: string;
}

/** What a caller may say about a unit of work. Everything has a default. */
export interface RunMeta {
  requestId?: string;
  source?: ChangeSource;
  branchId?: string;
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}

/** The id recorded as the actor when no person is acting. It never matches a profile. */
export const SYSTEM_USER_ID = '00000000-0000-7000-8000-000000000000';
/** The organisation id of a platform actor that is not working inside any one school. */
export const NO_ORG_ID = '00000000-0000-0000-0000-000000000000';

/** A permission set that holds everything, for system jobs. */
class EveryPermission extends Set<string> {
  override has(): boolean {
    return true;
  }
}
const everyPermission: ReadonlySet<string> = new EveryPermission();

// --- the clock -------------------------------------------------------------------------------

let clock: () => string = nowIso;

/** For tests: fixes the moment every new unit of work starts at. Pass nothing to return to the real clock. */
export function setClockForTests(fixed?: string | (() => string)): void {
  clock = fixed === undefined ? nowIso : typeof fixed === 'string' ? () => fixed : fixed;
}

/** The current moment, honouring a clock fixed by a test. For code that runs outside any unit of work. */
export const currentTime = (): string => clock();

// --- one unit of work at a time --------------------------------------------------------------

const running = new AsyncLocalStorage<{ kind: string }>();

function enter<T>(kind: string, work: () => Promise<T>): Promise<T> {
  const outer = running.getStore();
  if (outer) {
    // A second transaction inside the first would not see the first one's writes and would commit
    // or roll back on its own. Code that already has a `ctx` must pass it on instead.
    throw new Error(
      `${kind} was called inside ${outer.kind}. Pass the existing ctx to the function instead of opening another unit of work.`,
    );
  }
  return running.run({ kind }, work);
}

/** True while a unit of work is open in this call chain. */
export const insideUnitOfWork = (): boolean => running.getStore() !== undefined;

function buildCtx(db: Tx, actor: Actor, meta: RunMeta): Ctx {
  const now = clock();
  const requestId = meta.requestId ?? newRequestId();
  return {
    db,
    actor,
    requestId,
    source: meta.source ?? 'api',
    now,
    today: todayPk(now),
    log: childLogger({
      requestId,
      ...(actor.orgId !== NO_ORG_ID && { orgId: actor.orgId }),
      ...(actor.kind !== 'system' && { userId: actor.userId }),
    }),
    ...(meta.branchId !== undefined && { branchId: meta.branchId }),
    ...(meta.ip !== undefined && { ip: meta.ip }),
    ...(meta.userAgent !== undefined && { userAgent: meta.userAgent }),
    ...(meta.deviceId !== undefined && { deviceId: meta.deviceId }),
  };
}

/** What Postgres is told about the actor; the row-level-security policies read exactly this. */
export function claimsOf(actor: Actor): DbClaims {
  return {
    sub: actor.userId,
    role: 'authenticated',
    org_id: actor.orgId,
    // Row-level security knows three kinds. A system job works with a staff member's reach.
    kind: actor.kind === 'guardian' || actor.kind === 'student' ? actor.kind : 'staff',
    all_branches: actor.allBranches,
    branch_ids: actor.branchIds,
    student_ids: actor.studentIds,
    ...(actor.staffId !== undefined && { staff_id: actor.staffId }),
    ...(actor.guardianId !== undefined && { guardian_id: actor.guardianId }),
    ...(actor.familyId !== undefined && { family_id: actor.familyId }),
    caps: actor.caps,
  };
}

/** One transaction as a signed-in member of a school. Every query is filtered by row-level security. */
export function runAs<T>(actor: Actor, meta: RunMeta, work: (ctx: Ctx) => Promise<T>): Promise<T> {
  if (actor.kind === 'platform') {
    return Promise.reject(new Error('A platform actor cannot use runAs. Use runAsPlatform.'));
  }
  try {
    return enter('runAs', () =>
      withUserTx(claimsOf(actor), (db) => work(buildCtx(db, actor, meta))),
    );
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

/** The actor a background job runs as: every permission, every branch, one organisation. */
export function systemActor(orgId: string): Actor {
  return {
    userId: SYSTEM_USER_ID,
    orgId,
    membershipId: SYSTEM_USER_ID,
    kind: 'system',
    roleKeys: ['system'],
    permissions: everyPermission,
    allBranches: true,
    branchIds: [],
    studentIds: [],
    caps: capabilities,
    locale: 'en',
  };
}

/**
 * One transaction for a background job. It still runs inside row-level security, as staff of that
 * one organisation, so even a faulty job cannot reach another school's rows.
 */
export function runAsSystem<T>(
  orgId: string,
  meta: RunMeta,
  work: (ctx: Ctx) => Promise<T>,
): Promise<T> {
  const actor = systemActor(orgId);
  try {
    return enter('runAsSystem', () =>
      withUserTx(claimsOf(actor), (db) => work(buildCtx(db, actor, { source: 'job', ...meta }))),
    );
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

export interface PlatformAdmin {
  userId: string;
  role: 'super_admin' | 'support_agent';
}

/** What is written to the platform audit log for this unit of work. */
export interface PlatformAction extends RunMeta {
  /** A verb phrase, for example `org.suspend`. */
  action: string;
  /** The school being acted on, when there is one. */
  targetOrgId?: string;
  entityType?: string;
  entityId?: string;
  /** Extra facts worth keeping. Never secrets. */
  detail?: Record<string, unknown>;
}

/**
 * One transaction for Takhti's own staff, on the privileged connection: row-level security does
 * not apply, so every call is written to `platform_audit_log` in the same transaction.
 * The work and its record are saved together or not at all.
 */
export function runAsPlatform<T>(
  admin: PlatformAdmin,
  action: PlatformAction,
  work: (ctx: Ctx) => Promise<T>,
): Promise<T> {
  const actor: Actor = {
    userId: admin.userId,
    orgId: action.targetOrgId ?? NO_ORG_ID,
    membershipId: admin.userId,
    kind: 'platform',
    roleKeys: [admin.role],
    permissions: new Set(),
    allBranches: true,
    branchIds: [],
    studentIds: [],
    caps: capabilities,
    locale: 'en',
    platformRole: admin.role,
  };
  try {
    return enter('runAsPlatform', () =>
      withAdminTx(async (db) => {
        const ctx = buildCtx(db, actor, action);
        const result = await work(ctx);
        await db.insert(platformAuditLog).values({
          id: newId(),
          createdAt: ctx.now,
          adminUserId: admin.userId,
          action: action.action,
          targetOrgId: action.targetOrgId ?? null,
          entityType: action.entityType ?? null,
          entityId: action.entityId ?? null,
          detail: action.detail ?? {},
          ip: ctx.ip ?? null,
          requestId: ctx.requestId,
        });
        return result;
      }),
    );
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

/** The user id to write into `created_by` and `updated_by`: empty when no person is acting. */
export const stampOf = (ctx: Ctx): string | null =>
  ctx.actor.kind === 'system' ? null : ctx.actor.userId;
