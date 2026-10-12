import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { ListParams, Locale, NotificationChannel } from '@takhti/contracts';
import {
  channelSettings,
  domainEvents,
  messageDeliveries,
  messageOptOuts,
  notificationRules,
  notificationTemplates,
  notifications,
  orgs,
  userNotificationPrefs,
  whatsappTemplates,
} from '@takhti/db';
import { stampOf, type Ctx } from '../../kernel/context';
import { createDbService, type InsertOf, type RowOf } from '../../kernel/db-service';
import { newId } from '../../kernel/ids';
import type { RuleOverride } from './dispatch.rules';

/* Layer 3 for notification dispatch and delivery: what they read and write. No rule lives here. */

export type DeliveryRow = RowOf<typeof messageDeliveries>;
export type ChannelSettingRow = RowOf<typeof channelSettings>;

const deliveriesDb = createDbService<typeof messageDeliveries, ListParams>(messageDeliveries, {
  label: 'Message',
  sort: { createdAt: messageDeliveries.createdAt },
});

export interface TemplateOverride {
  channel: NotificationChannel;
  locale: Locale;
  subject: string | null;
  body: string;
  whatsappTemplateId: string | null;
}

export const messagingDb = {
  deliveries: deliveriesDb,

  async event(ctx: Ctx, eventId: string) {
    const [row] = await ctx.db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.id, eventId))
      .limit(1);
    return row;
  },

  /** The school's name in both languages, for `{{schoolName}}`. */
  async schoolName(ctx: Ctx): Promise<Record<Locale, string>> {
    const [org] = await ctx.db
      .select({ name: orgs.name, nameUr: orgs.nameUr })
      .from(orgs)
      .where(eq(orgs.id, ctx.actor.orgId))
      .limit(1);
    return { en: org?.name ?? '', ur: org?.nameUr ?? org?.name ?? '' };
  },

  async ruleOverrides(ctx: Ctx, eventKey: string): Promise<RuleOverride[]> {
    return ctx.db
      .select({
        audience: notificationRules.audience,
        isEnabled: notificationRules.isEnabled,
        channels: notificationRules.channels,
        alsoInApp: notificationRules.alsoInApp,
        delayMinutes: notificationRules.delayMinutes,
        digest: notificationRules.digest,
      })
      .from(notificationRules)
      .where(and(eq(notificationRules.eventKey, eventKey), isNull(notificationRules.deletedAt)));
  },

  /** The organisation's own wording for an event, where it has written any. */
  async templateOverrides(ctx: Ctx, eventKey: string): Promise<TemplateOverride[]> {
    return ctx.db
      .select({
        channel: notificationTemplates.channel,
        locale: notificationTemplates.locale,
        subject: notificationTemplates.subject,
        body: notificationTemplates.body,
        whatsappTemplateId: notificationTemplates.whatsappTemplateId,
      })
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.eventKey, eventKey),
          eq(notificationTemplates.isActive, true),
          isNull(notificationTemplates.deletedAt),
        ),
      );
  },

  /** Of the given WhatsApp templates, those the provider has approved, with the name it knows them by. */
  async approvedWhatsappTemplates(ctx: Ctx, ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await ctx.db
      .select({ id: whatsappTemplates.id, name: whatsappTemplates.name })
      .from(whatsappTemplates)
      .where(
        and(
          inArray(whatsappTemplates.id, [...new Set(ids)]),
          eq(whatsappTemplates.status, 'approved'),
          isNull(whatsappTemplates.deletedAt),
        ),
      );
    return new Map(rows.map((row) => [row.id, row.name]));
  },

  async channels(ctx: Ctx): Promise<Map<string, ChannelSettingRow>> {
    const rows = (await ctx.db
      .select()
      .from(channelSettings)
      .where(isNull(channelSettings.deletedAt))) as ChannelSettingRow[];
    return new Map(rows.map((row) => [row.channel, row]));
  },

  /** For each person, what they muted, as `category:channel`. */
  async mutes(ctx: Ctx, userIds: readonly string[]): Promise<Map<string, Set<string>>> {
    const found = new Map<string, Set<string>>();
    if (userIds.length === 0) return found;
    const rows = await ctx.db
      .select({
        userId: userNotificationPrefs.userId,
        category: userNotificationPrefs.category,
        channel: userNotificationPrefs.channel,
      })
      .from(userNotificationPrefs)
      .where(
        and(
          inArray(userNotificationPrefs.userId, [...new Set(userIds)]),
          eq(userNotificationPrefs.isMuted, true),
          isNull(userNotificationPrefs.deletedAt),
        ),
      );
    for (const row of rows) {
      const mine = found.get(row.userId) ?? new Set<string>();
      mine.add(`${row.category}:${row.channel}`);
      found.set(row.userId, mine);
    }
    return found;
  },

  /** Addresses that must not be messaged, as `channel:address`. */
  async optOuts(ctx: Ctx, addresses: readonly string[]): Promise<Set<string>> {
    if (addresses.length === 0) return new Set();
    const rows = await ctx.db
      .select({ channel: messageOptOuts.channel, address: messageOptOuts.address })
      .from(messageOptOuts)
      .where(
        and(inArray(messageOptOuts.address, [...new Set(addresses)]), isNull(messageOptOuts.deletedAt)),
      );
    return new Set(rows.map((row) => `${row.channel}:${row.address}`));
  },

  /**
   * Writes an in-app notification unless one with the same dedupe key exists.
   * Returns its id, or undefined when it was already there.
   */
  async addNotification(
    ctx: Ctx,
    values: Omit<InsertOf<typeof notifications>, 'id'>,
  ): Promise<string | undefined> {
    const stamp = stampOf(ctx);
    const [row] = await ctx.db
      .insert(notifications)
      .values({
        ...values,
        id: newId(),
        orgId: ctx.actor.orgId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        createdBy: stamp,
        updatedBy: stamp,
      })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    return row?.id;
  },

  async notificationIdByKey(ctx: Ctx, dedupeKey: string): Promise<string | undefined> {
    const [row] = await ctx.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.dedupeKey, dedupeKey), isNull(notifications.deletedAt)))
      .limit(1);
    return row?.id;
  },

  async notificationTitle(ctx: Ctx, id: string): Promise<string | undefined> {
    const [row] = await ctx.db
      .select({ title: notifications.title })
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);
    return row?.title;
  },

  /** Writes a delivery unless one with the same dedupe key exists. Returns it, or undefined when it was already there. */
  async addDelivery(
    ctx: Ctx,
    values: Omit<InsertOf<typeof messageDeliveries>, 'id'>,
  ): Promise<DeliveryRow | undefined> {
    const stamp = stampOf(ctx);
    const [row] = await ctx.db
      .insert(messageDeliveries)
      .values({
        ...values,
        id: newId(),
        orgId: ctx.actor.orgId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        createdBy: stamp,
        updatedBy: stamp,
      })
      .onConflictDoNothing()
      .returning();
    return row as DeliveryRow | undefined;
  },
};
