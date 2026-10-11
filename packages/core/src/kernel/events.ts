import { z } from 'zod';
import type { EventDef } from '@takhti/contracts';
import { domainEvents } from '@takhti/db';
import { stampOf, type Ctx } from './context';
import { newId } from './ids';
import { enqueue, type JobDefinition } from './jobs';
import { notifyDispatchJob } from './notify';

/*
 * Domain events: facts such as `fee.payment-received`.
 *
 * `emit` writes the event in the caller's transaction and queues whatever follows from it:
 * the notification dispatch, and any job a module subscribed with `onEvent`. If the transaction
 * rolls back, the event never happened and nothing is sent.
 */

interface Subscription {
  job: JobDefinition;
  /** Builds the job's payload from the event's. */
  payload: (eventPayload: unknown, event: { id: string; key: string }) => unknown;
}

const subscriptions = new Map<string, Subscription[]>();

/** Runs a job every time an event is emitted: `onEvent(feePaymentReceived, postToLedgerJob, (p) => ({ paymentId: p.paymentId }))`. */
export function onEvent<P extends z.ZodType, J extends z.ZodType>(
  event: EventDef<P>,
  job: JobDefinition<J>,
  payload: (eventPayload: z.output<P>, event: { id: string; key: string }) => z.input<J>,
): void {
  const list = subscriptions.get(event.key) ?? [];
  // Re-registering the same job (a module file loaded twice in development) replaces the earlier entry.
  const others = list.filter((entry) => entry.job.name !== job.name);
  others.push({
    job: job as unknown as JobDefinition,
    payload: payload as Subscription['payload'],
  });
  subscriptions.set(event.key, others);
}

export interface EventSubject {
  /** The resource the event is about, for example `fee-payments`. */
  entityType?: string;
  entityId?: string;
}

/** Records an event and queues what follows from it. Returns the event's id. */
export async function emit<P extends z.ZodType>(
  ctx: Ctx,
  event: EventDef<P>,
  payload: z.input<P>,
  subject: EventSubject = {},
): Promise<string> {
  const parsed = event.payload.safeParse(payload);
  // A wrong payload is a programming error, not something the user typed.
  if (!parsed.success)
    throw new Error(
      `Payload for event "${event.key}" is not valid: ${z.prettifyError(parsed.error)}`,
    );

  const id = newId();
  // No `returning`: a family user's action may raise an event, but only staff can read the event log.
  await ctx.db.insert(domainEvents).values({
    id,
    orgId: ctx.actor.orgId,
    createdAt: ctx.now,
    createdBy: stampOf(ctx),
    name: event.key,
    payload: parsed.data as never,
    entityType: subject.entityType ?? null,
    entityId: subject.entityId ?? null,
    requestId: ctx.requestId,
    source: ctx.source,
  });

  if (event.rules.length > 0) {
    await enqueue(ctx, notifyDispatchJob, { eventId: id }, { dedupeKey: `notify:${id}` });
  }
  for (const subscription of subscriptions.get(event.key) ?? []) {
    await enqueue(
      ctx,
      subscription.job,
      subscription.payload(parsed.data, { id, key: event.key }) as never,
      {
        dedupeKey: `event:${id}:${subscription.job.name}`,
      },
    );
  }
  return id;
}
