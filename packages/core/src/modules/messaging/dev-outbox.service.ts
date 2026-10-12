import { and, eq } from 'drizzle-orm';
import {
  DevOutboxMessage,
  type CursorPage,
  type DevOutboxQuery,
} from '@takhti/contracts';
import { messageDeliveries } from '@takhti/db';
import type { Ctx } from '../../kernel/context';
import { isProduction } from '../../kernel/env';
import { notFound } from '../../kernel/errors';
import { messagingDb } from './messaging.db-service';

/*
 * The developer outbox. The local stand-ins send nothing; they are named `log` on the delivery,
 * and this lists those deliveries, newest first. The worker and the web app are separate
 * processes, so the list is read from the delivery table, not from either one's memory.
 */
export const devOutbox = {
  async list(ctx: Ctx, params: DevOutboxQuery): Promise<CursorPage<DevOutboxMessage>> {
    // It does not exist in production: there, a message really was sent, and who may read it is
    // decided by the delivery log and its permission.
    if (isProduction()) throw notFound('Page');
    const page = await messagingDb.deliveries.listCursor(
      ctx,
      params,
      and(
        eq(messageDeliveries.provider, 'log'),
        params.channel && eq(messageDeliveries.channel, params.channel),
      ),
    );
    return { ...page, items: page.items.map((row) => DevOutboxMessage.parse(row)) };
  },
};
