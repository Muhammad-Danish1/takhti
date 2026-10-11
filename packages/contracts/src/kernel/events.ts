import type { z } from 'zod';
import type { Locale } from './primitives';

/*
 * Domain events: recorded facts such as `fee.payment-received`. A service calls `emit(ctx, key, payload)`;
 * notifications, jobs and outgoing webhooks follow from the event.
 * Each module declares its events in `<module>.events.ts`; the catalogue gathers them.
 * Rules for categories, audiences, channels and wording: docs/plan/30-reference/notification-catalogue.md.
 */

export const notificationCategories = [
  'fees',
  'attendance',
  'academics',
  'health',
  'messages',
  'admissions',
  'people',
  'money-office',
  'approvals',
  'system',
] as const;
export type NotificationCategory = (typeof notificationCategories)[number];

export const notificationChannels = ['in_app', 'push', 'whatsapp', 'sms', 'email'] as const;
export type NotificationChannel = (typeof notificationChannels)[number];
export type OutsideChannel = Exclude<NotificationChannel, 'in_app'>;

/** Who is told. Each is resolved to people by a function in the messaging module. */
export const audiences = [
  'guardians-of-student',
  'guardians-of-family',
  'guardians-of-section',
  'student',
  'class-teacher-of-section',
  'teachers-of-section',
  'staff',
  'manager-of-staff',
  'role-at-branch',
  'role-in-org',
  'requester',
  'approvers-of-request',
  'owner-of-record',
  'user',
  'platform-staff',
] as const;
export type Audience = (typeof audiences)[number];

export interface EventRule {
  audience: Audience;
  /** Outside channels in order of preference; the first that can deliver is used. In-app is always written. */
  channels: readonly OutsideChannel[];
  /** For `role-at-branch` and `role-in-org`. */
  roleKeys?: readonly string[];
}

type Localised<T> = Record<Locale, T>;

export interface EventTemplates {
  in_app?: Localised<{ title: string; body: string }>;
  push?: Localised<{ title: string; body: string }>;
  whatsapp?: Localised<string>;
  sms?: Localised<string>;
  email?: Localised<{ subject: string; body: string }>;
}

export interface EventDef<P extends z.ZodType = z.ZodType> {
  /** `<thing>.<what-happened>`, for example `fee.payment-received`. */
  key: `${string}.${string}`;
  category: NotificationCategory;
  /** What the emitting service must supply. */
  payload: P;
  /** Names a template may use, in camel case. */
  variables: readonly string[];
  /** Who is told by default. Empty for an event that only jobs or webhooks listen to. */
  rules: readonly EventRule[];
  /** Ignores quiet hours and mutes, and goes on every enabled channel at once. */
  urgent?: boolean;
  /** Cannot be muted: receipts, security notices, safety messages. */
  compulsory?: boolean;
  /** Several children of one family in the same dispatch produce one message naming them all. */
  mergePerFamily?: boolean;
  /** Collected and sent once a day or week rather than one by one. */
  digest?: 'daily' | 'weekly';
  /** Default wording. Placeholders until Phase 12 writes the real text. */
  templates?: EventTemplates;
}

export function defineEvent<P extends z.ZodType>(def: EventDef<P>): EventDef<P> {
  if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(def.key)) {
    throw new Error(`Event key "${def.key}" must look like thing.what-happened`);
  }
  return def;
}

export type EventPayload<D> = D extends EventDef<infer P> ? z.output<P> : never;
