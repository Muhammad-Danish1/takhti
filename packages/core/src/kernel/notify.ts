import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { findEvent, Id, type EventDef } from '@takhti/contracts';
import { domainEvents } from '@takhti/db';
import type { Ctx } from './context';
import { defineJob } from './jobs';

/*
 * Turning an event into messages.
 *
 * `emit` records the event and queues `notify.dispatch` in the same transaction. This job then
 * hands the event to the dispatcher, which works out who is told and on which channel.
 *
 * The dispatcher itself belongs to the messaging module (M37), which owns the notification tables,
 * people's preferences and the channel providers. Until that module is installed the job finishes
 * without telling anyone, and says so in the log: nothing is half-sent.
 */

export interface RecordedEvent {
  id: string;
  name: string;
  payload: unknown;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export type NotificationDispatcher = (
  ctx: Ctx,
  event: RecordedEvent,
  definition: EventDef,
) => Promise<void>;

let dispatcher: NotificationDispatcher | undefined;

/** Installed once by the messaging module. */
export function setNotificationDispatcher(next: NotificationDispatcher | undefined): void {
  dispatcher = next;
}

export const notifyDispatchJob = defineJob({
  name: 'notify.dispatch',
  payload: z.object({ eventId: Id }),
  retries: 5,
  timeoutSeconds: 120,
  handler: async (ctx, { eventId }) => {
    const [event] = await ctx.db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.id, eventId))
      .limit(1);
    if (!event) {
      ctx.log.warn({ eventId }, 'event to dispatch was not found');
      return;
    }
    const definition = findEvent(event.name);
    if (!definition || definition.rules.length === 0) return;
    if (!dispatcher) {
      ctx.log.debug(
        { event: event.name },
        'no notification dispatcher is installed; nobody was told',
      );
      return;
    }
    await dispatcher(
      ctx,
      {
        id: event.id,
        name: event.name,
        payload: event.payload,
        entityType: event.entityType,
        entityId: event.entityId,
        createdAt: event.createdAt,
      },
      definition,
    );
  },
});
