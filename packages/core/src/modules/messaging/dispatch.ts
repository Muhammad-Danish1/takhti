import { z } from 'zod';
import {
  Id,
  type EventDef,
  type Locale,
  type NotificationChannel,
  type OutsideChannel,
} from '@takhti/contracts';
import type { Ctx } from '../../kernel/context';
import { addSeconds, isLaterMoment } from '../../kernel/dates';
import { defineJob, enqueue } from '../../kernel/jobs';
import {
  eventDefinition,
  setNotificationDispatcher,
  type RecordedEvent,
} from '../../kernel/notify';
import { messageProvider, type OutgoingMessage } from '../../providers/messaging';
import {
  mergeRecipients,
  resolveAudience,
  studentNames,
  type Recipient,
} from './audiences';
import {
  defaultWording,
  effectiveRules,
  isMuted,
  quietUntil,
  titleFromKey,
  type Wording,
} from './dispatch.rules';
import {
  messagingDb,
  type ChannelSettingRow,
  type DeliveryRow,
  type TemplateOverride,
} from './messaging.db-service';
import { renderTemplate, smsSize } from './render';

/*
 * Turning an event into messages: docs/plan/10-modules/m37-messaging-hub.md, rules R-messaging-2
 * to 9, and docs/plan/00-foundation/13-notifications-jobs-and-files.md, section 2.
 *
 *   emit → notify.dispatch → for each person: the bell, and one delivery on the first channel
 *          that can reach them → notify.deliver → the provider → sent, or the next channel
 *
 * Everything here is safe to run twice: each notification and each delivery has a dedupe key made
 * of the event, the person and the channel, so a second run adds nothing (R-messaging-3).
 *
 * Left for step 2.12, with the rest of the module: the cost of a message and the credit it uses,
 * daily digests, the sending rate, provider callbacks, and campaigns.
 */

// ---------------------------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------------------------

/** Extra variables a module supplies for its event: amounts as `Rs 8,500`, dates as `12 Oct`, links. */
export type EventVariables = (
  ctx: Ctx,
  payload: Readonly<Record<string, unknown>>,
  recipient: Recipient,
) => Promise<Record<string, string>> | Record<string, string>;

const enrichers = new Map<string, EventVariables>();

/** Registered by the module that owns the event, beside its service. */
export function registerEventVariables(event: Pick<EventDef, 'key'>, variables: EventVariables): void {
  enrichers.set(event.key, variables);
}

/** "Ali", "Ali and Sara", "Ali, Sara and Hamza"; in Urdu with its own comma and "and". */
export function joinNames(names: readonly string[], locale: Locale): string {
  if (names.length <= 1) return names[0] ?? '';
  const and = locale === 'ur' ? ' اور ' : ' and ';
  const comma = locale === 'ur' ? '، ' : ', ';
  return `${names.slice(0, -1).join(comma)}${and}${names[names.length - 1]}`;
}

// ---------------------------------------------------------------------------------------------
// What dispatch knows about the school while it works
// ---------------------------------------------------------------------------------------------

interface Surroundings {
  event: RecordedEvent;
  definition: EventDef;
  payload: Readonly<Record<string, unknown>>;
  schoolName: Record<Locale, string>;
  channels: Map<string, ChannelSettingRow>;
  templates: TemplateOverride[];
  /** WhatsApp template id → the name the provider approved. */
  approved: Map<string, string>;
  mutes: Map<string, Set<string>>;
  optOuts: Set<string>;
  children: Map<string, { en: string; ur: string }>;
}

interface Planned {
  recipient: Recipient;
  channels: OutsideChannel[];
  inApp: boolean;
  delayMinutes: number;
  digest: boolean;
}

/** Who an event reaches and how, before anything is written: every rule's audience, one entry per person. */
async function planRecipients(
  ctx: Ctx,
  definition: EventDef,
  event: RecordedEvent,
  payload: Readonly<Record<string, unknown>>,
): Promise<Planned[]> {
  const rules = effectiveRules(definition, await messagingDb.ruleOverrides(ctx, event.name));
  const plans = new Map<string, Planned>();
  for (const rule of rules) {
    const people = await resolveAudience(ctx, rule.audience, {
      payload,
      roleKeys: rule.roleKeys,
    });
    for (const person of people) {
      const existing = plans.get(person.key);
      if (!existing) {
        plans.set(person.key, {
          recipient: person,
          channels: [...rule.channels],
          inApp: rule.inApp,
          delayMinutes: rule.delayMinutes,
          digest: rule.digest,
        });
        continue;
      }
      // Found by a second rule: one person, every child, the channels of both in order.
      existing.recipient = mergeRecipients([existing.recipient, person])[0] as Recipient;
      for (const channel of rule.channels)
        if (!existing.channels.includes(channel)) existing.channels.push(channel);
      existing.inApp ||= rule.inApp;
      existing.digest &&= rule.digest;
    }
  }
  return [...plans.values()];
}

async function surroundingsOf(
  ctx: Ctx,
  event: RecordedEvent,
  definition: EventDef,
  payload: Readonly<Record<string, unknown>>,
  recipients: readonly Recipient[],
): Promise<Surroundings> {
  const templates = await messagingDb.templateOverrides(ctx, event.name);
  const addresses = recipients.flatMap((person) =>
    [person.phone, person.whatsapp, person.email].filter((value): value is string => !!value),
  );
  return {
    event,
    definition,
    payload,
    schoolName: await messagingDb.schoolName(ctx),
    channels: await messagingDb.channels(ctx),
    templates,
    approved: await messagingDb.approvedWhatsappTemplates(
      ctx,
      templates.flatMap((template) => template.whatsappTemplateId ?? []),
    ),
    mutes: await messagingDb.mutes(
      ctx,
      recipients.flatMap((person) => person.userId ?? []),
    ),
    optOuts: await messagingDb.optOuts(ctx, addresses),
    children: await studentNames(
      ctx,
      recipients.flatMap((person) => person.studentIds),
    ),
  };
}

async function variablesFor(
  ctx: Ctx,
  around: Surroundings,
  recipient: Recipient,
): Promise<Record<string, string>> {
  const { locale } = recipient;
  const names = recipient.studentIds.flatMap((id) => around.children.get(id)?.[locale] ?? []);
  const fromPayload: Record<string, string> = {};
  for (const [name, value] of Object.entries(around.payload)) {
    if (typeof value === 'string' || typeof value === 'number') fromPayload[name] = String(value);
  }
  const fromModule = (await enrichers.get(around.event.name)?.(ctx, around.payload, recipient)) ?? {};
  return {
    ...fromPayload,
    schoolName: around.schoolName[locale],
    recipientName: recipient.name,
    ...(recipient.kind === 'guardian' && { guardianName: recipient.name }),
    ...(recipient.kind === 'staff' && { staffName: recipient.name }),
    ...(names.length > 0 && { studentName: names[0] as string, studentNames: joinNames(names, locale) }),
    ...fromModule,
  };
}

/** The wording for a channel: the organisation's own where it has written it, else the catalogue's. */
function wordingFor(
  around: Surroundings,
  channel: NotificationChannel,
  locale: Locale,
): (Wording & { whatsappTemplateId: string | null }) | undefined {
  const own =
    around.templates.find((item) => item.channel === channel && item.locale === locale) ??
    around.templates.find((item) => item.channel === channel);
  if (own)
    return {
      body: own.body,
      ...(own.subject && { title: own.subject }),
      whatsappTemplateId: own.whatsappTemplateId,
    };
  const standard = defaultWording(around.definition.templates, channel, locale);
  return standard && { ...standard, whatsappTemplateId: null };
}

const addressFor = (recipient: Recipient, channel: OutsideChannel): string | null =>
  channel === 'sms'
    ? recipient.phone
    : channel === 'whatsapp'
      ? recipient.whatsapp
      : channel === 'email'
        ? recipient.email
        : // Device tokens arrive with the mobile apps (Phase 23).
          null;

// ---------------------------------------------------------------------------------------------
// Placing one person's message on a channel
// ---------------------------------------------------------------------------------------------

const dedupeKey = (eventId: string, recipient: Recipient, channel: NotificationChannel) =>
  `${eventId}:${recipient.key}:${channel}`;

interface Placement {
  notificationId: string | undefined;
  variables: Record<string, string>;
  delayMinutes: number;
  /** The delivery this one replaces, when the channel before it could not reach the person. */
  fallbackOfId?: string;
}

/**
 * Tries the channels in order and stops at the first that can reach the person (R-messaging-2).
 * A channel that cannot (no number, opted out, no approved WhatsApp template) is recorded as skipped
 * with its reason, and the next one is linked to it (R-messaging-8). An urgent event does not stop:
 * it goes on every channel that can reach the person.
 */
async function placeOnChannels(
  ctx: Ctx,
  around: Surroundings,
  recipient: Recipient,
  channels: readonly OutsideChannel[],
  placement: Placement,
): Promise<void> {
  const { definition, event } = around;
  const urgent = definition.urgent === true;
  const mustTell = urgent || definition.compulsory === true;
  let replaces = placement.fallbackOfId;

  for (const channel of channels) {
    const setting = around.channels.get(channel);
    // A channel the school has not switched on is not a failure to record; the next one is tried.
    if (!setting?.isEnabled) continue;
    const wording = wordingFor(around, channel, recipient.locale);
    if (!wording) continue;

    const address = addressFor(recipient, channel);
    const rendered = renderTemplate(wording.body, placement.variables);
    const base = {
      channel,
      userId: recipient.userId,
      guardianId: recipient.guardianId,
      staffId: recipient.staffId,
      address: address ?? '',
      eventKey: event.name,
      notificationId: placement.notificationId ?? null,
      locale: recipient.locale,
      body: rendered.text,
      parts: channel === 'sms' ? smsSize(rendered.text).parts : 1,
      provider: messageProvider(channel).name,
      fallbackOfId: replaces ?? null,
      dedupeKey: dedupeKey(event.id, recipient, channel),
    };
    const skip = async (
      skipReason: 'muted' | 'no_address' | 'opted_out' | 'template_not_approved',
    ) => messagingDb.addDelivery(ctx, { ...base, status: 'skipped', skipReason });

    // R-messaging-7: their own choice, so nothing else is tried in its place.
    if (recipient.userId && isMuted(definition, channel, around.mutes.get(recipient.userId) ?? new Set())) {
      await skip('muted');
      if (urgent) continue;
      return;
    }

    let reason: 'no_address' | 'opted_out' | 'template_not_approved' | undefined;
    if (!address) reason = 'no_address';
    // R-messaging-10: an opt-out stops everything except what must be told.
    else if (!mustTell && around.optOuts.has(`${channel}:${address}`)) reason = 'opted_out';
    // R-messaging-11: WhatsApp only with a template the provider approved for this kind of message.
    else if (
      channel === 'whatsapp' &&
      !(wording.whatsappTemplateId && around.approved.has(wording.whatsappTemplateId))
    )
      reason = 'template_not_approved';
    if (reason) {
      const skipped = await skip(reason);
      if (skipped) replaces = skipped.id;
      continue;
    }

    // R-messaging-6: in quiet hours a message that is not urgent waits for the morning.
    const earliest =
      placement.delayMinutes > 0 ? addSeconds(ctx.now, placement.delayMinutes * 60) : ctx.now;
    const quietEnd = urgent ? undefined : quietUntil(earliest, setting.quietFrom, setting.quietTo);
    const sendAfter = quietEnd ?? (placement.delayMinutes > 0 ? earliest : undefined);
    const delivery = await messagingDb.addDelivery(ctx, {
      ...base,
      status: quietEnd ? 'held' : 'queued',
      sendAfter: sendAfter ?? null,
    });
    // Already there: an earlier run of this dispatch placed it, and queued its sending.
    if (delivery)
      await enqueue(
        ctx,
        notifyDeliverJob,
        { deliveryId: delivery.id, eventId: event.id },
        { dedupeKey: `deliver:${delivery.id}`, ...(sendAfter && { runAt: sendAfter }) },
      );
    if (!urgent) return;
  }
}

// ---------------------------------------------------------------------------------------------
// notify.dispatch
// ---------------------------------------------------------------------------------------------

export interface DispatchResult {
  recipients: number;
  notifications: number;
}

/** Tells everyone an event concerns. Installed as the kernel's dispatcher when this file is loaded. */
export async function dispatchEvent(
  ctx: Ctx,
  event: RecordedEvent,
  definition: EventDef,
): Promise<DispatchResult> {
  const payload = (event.payload ?? {}) as Readonly<Record<string, unknown>>;
  const plans = await planRecipients(ctx, definition, event, payload);
  if (plans.length === 0) {
    ctx.log.debug({ event: event.name }, 'the event reaches nobody');
    return { recipients: 0, notifications: 0 };
  }
  const around = await surroundingsOf(
    ctx,
    event,
    definition,
    payload,
    plans.map((plan) => plan.recipient),
  );

  let written = 0;
  for (const plan of plans) {
    const { recipient } = plan;
    const variables = await variablesFor(ctx, around, recipient);

    // The bell. Always written for a person with a login, so nobody is left with nothing.
    let notificationId: string | undefined;
    const wantsBell =
      plan.inApp &&
      recipient.userId !== null &&
      !isMuted(definition, 'in_app', around.mutes.get(recipient.userId) ?? new Set());
    if (wantsBell && recipient.userId) {
      const wording = wordingFor(around, 'in_app', recipient.locale);
      const key = dedupeKey(event.id, recipient, 'in_app');
      const link = variables.link;
      notificationId = await messagingDb.addNotification(ctx, {
        userId: recipient.userId,
        eventKey: event.name,
        category: definition.category,
        title: renderTemplate(wording?.title ?? titleFromKey(event.name), variables).text,
        body: wording ? renderTemplate(wording.body, variables).text : '',
        link: link?.startsWith('/') ? link : null,
        entityType: event.entityType,
        entityId: event.entityId,
        studentId: recipient.studentIds.length === 1 ? (recipient.studentIds[0] as string) : null,
        isUrgent: definition.urgent === true,
        dedupeKey: key,
      });
      if (notificationId) written += 1;
      else notificationId = await messagingDb.notificationIdByKey(ctx, key);
    }

    // A digest is gathered and sent once a day by `notify.digests`, not message by message.
    if (plan.digest) continue;
    await placeOnChannels(ctx, around, recipient, plan.channels, {
      notificationId,
      variables,
      delayMinutes: plan.delayMinutes,
    });
  }
  return { recipients: plans.length, notifications: written };
}

setNotificationDispatcher(async (ctx, event, definition) => {
  await dispatchEvent(ctx, event, definition);
});

// ---------------------------------------------------------------------------------------------
// notify.deliver
// ---------------------------------------------------------------------------------------------

/** R-messaging-9: a temporary failure is tried again three times, each wait longer than the last. */
const RETRY_AFTER_SECONDS = [60, 300, 900] as const;

/** The channels a failed or skipped delivery may fall back to: those after it in the person's order. */
async function fallBack(ctx: Ctx, failed: DeliveryRow, eventId: string): Promise<void> {
  const row = await messagingDb.event(ctx, eventId);
  const definition = row && eventDefinition(row.name);
  if (!row || !definition) return;
  const event: RecordedEvent = {
    id: row.id,
    name: row.name,
    payload: row.payload,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt,
  };
  const payload = (event.payload ?? {}) as Readonly<Record<string, unknown>>;
  const plan = (await planRecipients(ctx, definition, event, payload)).find(
    ({ recipient }) =>
      (failed.guardianId !== null && recipient.guardianId === failed.guardianId) ||
      (failed.staffId !== null && recipient.staffId === failed.staffId) ||
      (failed.userId !== null && recipient.userId === failed.userId),
  );
  if (!plan) return;
  const after = plan.channels.slice(plan.channels.indexOf(failed.channel) + 1);
  if (after.length === 0) return;
  const around = await surroundingsOf(ctx, event, definition, payload, [plan.recipient]);
  await placeOnChannels(ctx, around, plan.recipient, after, {
    notificationId: failed.notificationId ?? undefined,
    variables: await variablesFor(ctx, around, plan.recipient),
    delayMinutes: 0,
    fallbackOfId: failed.id,
  });
}

export const notifyDeliverJob = defineJob({
  name: 'notify.deliver',
  payload: z.object({ deliveryId: Id, eventId: Id.optional() }),
  // The delivery keeps its own count of tries, so a retry is a new job and its record survives.
  retries: 2,
  timeoutSeconds: 60,
  handler: async (ctx, { deliveryId, eventId }) => {
    const delivery = await messagingDb.deliveries.lock(ctx, deliveryId);
    // Sent already, or dealt with: running twice changes nothing.
    if (delivery.status !== 'queued' && delivery.status !== 'held') return;
    if (delivery.sendAfter && isLaterMoment(delivery.sendAfter, ctx.now)) {
      await enqueue(ctx, notifyDeliverJob, { deliveryId, eventId }, { runAt: delivery.sendAfter });
      return;
    }

    const message: OutgoingMessage = {
      to: delivery.address,
      body: delivery.body,
      reference: delivery.id,
    };
    if (delivery.channel === 'email' || delivery.channel === 'push') {
      const title = delivery.notificationId
        ? await messagingDb.notificationTitle(ctx, delivery.notificationId)
        : undefined;
      message.subject = title ?? (delivery.eventKey ? titleFromKey(delivery.eventKey) : '');
    }

    const attempts = delivery.attempts + 1;
    const result = await messageProvider(delivery.channel).send(message);
    if (result.ok) {
      await messagingDb.deliveries.update(ctx, delivery.id, {
        status: 'sent',
        attempts,
        providerMessageId: result.providerMessageId,
        sentAt: ctx.now,
        error: null,
        errorCode: null,
      });
      return;
    }

    const wait = result.retryable ? RETRY_AFTER_SECONDS[attempts - 1] : undefined;
    if (wait !== undefined) {
      const sendAfter = addSeconds(ctx.now, wait);
      await messagingDb.deliveries.update(ctx, delivery.id, {
        status: 'queued',
        attempts,
        sendAfter,
        error: result.reason,
      });
      await enqueue(ctx, notifyDeliverJob, { deliveryId, eventId }, { runAt: sendAfter });
      return;
    }

    // Refused for good, or still failing after every retry: the next channel takes over (R-messaging-8).
    const failed = await messagingDb.deliveries.update(ctx, delivery.id, {
      status: 'failed',
      attempts,
      error: result.reason,
    });
    if (eventId) await fallBack(ctx, failed, eventId);
  },
});
