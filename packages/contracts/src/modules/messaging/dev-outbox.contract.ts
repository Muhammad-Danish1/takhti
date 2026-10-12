import { z } from 'zod';
import { locales } from '../../kernel/primitives';
import { cursorQuery } from '../../kernel/resource';
import { messageDeliveryChannels, messageDeliveryStatuses } from './messaging.constants';

/*
 * The developer outbox: `GET /dev/outbox`, docs/plan/10-modules/m37-messaging-hub.md, section 7.
 * On a developer's machine no message leaves: the local stand-ins record what would have gone out,
 * and this list shows it. It does not exist in production.
 */

export const DevOutboxQuery = cursorQuery({
  filters: { channel: z.enum(messageDeliveryChannels).optional() },
});
export type DevOutboxQuery = z.output<typeof DevOutboxQuery>;

/** One message a local stand-in "sent", as it would have reached the person. */
export const DevOutboxMessage = z.object({
  id: z.uuid(),
  channel: z.enum(messageDeliveryChannels),
  /** The phone number or email address, in full: this is a developer's own test data. */
  address: z.string(),
  locale: z.enum(locales),
  eventKey: z.string().nullable(),
  body: z.string(),
  status: z.enum(messageDeliveryStatuses),
  sentAt: z.string().nullable(),
  createdAt: z.string(),
});
export type DevOutboxMessage = z.output<typeof DevOutboxMessage>;
