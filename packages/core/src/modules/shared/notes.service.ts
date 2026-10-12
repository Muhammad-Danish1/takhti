import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import {
  roleGroups,
  type CreateNote,
  type ListNotes,
  type ListParams,
  type Note,
  type SavedView,
  type CreateSavedView,
  type ListSavedViews,
  type UpdateNote,
  type UpdateSavedView,
  MAX_SAVED_VIEWS,
} from '@takhti/contracts';
import { notes, profiles, savedViews } from '@takhti/db';
import { audit } from '../../kernel/audit';
import type { Ctx } from '../../kernel/context';
import { createDbService } from '../../kernel/db-service';
import { forbidden, notFound, rule } from '../../kernel/errors';
import { assertPermission } from '../../kernel/permissions';
import { canReadRecord } from '../../kernel/record-access';
import { hasAnyRole } from '../../kernel/scope';

/*
 * Staff notes on any record, and a person's saved views of a list.
 * docs/plan/10-modules/m00-shared-kernel.md.
 */

const notesDb = createDbService<typeof notes, ListParams>(notes, {
  label: 'Note',
  sort: { createdAt: notes.createdAt },
});
const viewsDb = createDbService<typeof savedViews, ListParams>(savedViews, {
  label: 'Saved view',
  sort: { createdAt: savedViews.createdAt },
});

/** A note marked for leaders is read by the leaders of the school, and by its author. */
const isLeader = (ctx: Ctx): boolean => hasAnyRole(ctx, [...roleGroups.LEADERS, 'owner']);

type NoteRow = typeof notes.$inferSelect;

async function toNotes(ctx: Ctx, rows: readonly NoteRow[]): Promise<Note[]> {
  const authors = [...new Set(rows.flatMap((row) => row.createdBy ?? []))];
  const names =
    authors.length === 0
      ? []
      : await ctx.db
          .select({ id: profiles.id, fullName: profiles.fullName })
          .from(profiles)
          .where(inArray(profiles.id, authors));
  const nameOf = new Map(names.map((row) => [row.id, row.fullName]));
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    entityType: row.entityType,
    entityId: row.entityId,
    body: row.body,
    visibility: row.visibility,
    isPinned: row.isPinned,
    createdBy: row.createdBy,
    authorName: row.createdBy ? (nameOf.get(row.createdBy) ?? null) : null,
    mine: row.createdBy === ctx.actor.userId,
  }));
}

/** A note is its author's to change. To anyone who cannot even see it, it does not exist. */
async function ownNote(ctx: Ctx, id: string): Promise<NoteRow> {
  const row = await notesDb.find(ctx, id);
  if (!row || !(await canReadRecord(ctx, row.entityType, row.entityId))) throw notFound('Note');
  if (row.createdBy !== ctx.actor.userId) {
    if (row.visibility === 'leaders' && !isLeader(ctx)) throw notFound('Note');
    throw forbidden('Only the person who wrote a note can change it');
  }
  return row;
}

export const notesService = {
  /** The notes on a record the person can open: pinned first, then newest first. */
  async list(ctx: Ctx, query: ListNotes): Promise<Note[]> {
    assertPermission(ctx, 'notes:read');
    if (!(await canReadRecord(ctx, query.entityType, query.entityId))) throw notFound('Record');
    const rows = await ctx.db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.entityType, query.entityType),
          eq(notes.entityId, query.entityId),
          isNull(notes.deletedAt),
        ),
      )
      .orderBy(desc(notes.isPinned), desc(notes.createdAt), desc(notes.id));
    const leader = isLeader(ctx);
    return toNotes(
      ctx,
      rows.filter(
        (row) => row.visibility === 'staff' || leader || row.createdBy === ctx.actor.userId,
      ),
    );
  },

  async create(ctx: Ctx, input: CreateNote): Promise<Note> {
    assertPermission(ctx, 'notes:create');
    if (!(await canReadRecord(ctx, input.entityType, input.entityId))) throw notFound('Record');
    const row = await notesDb.insert(ctx, {
      entityType: input.entityType,
      entityId: input.entityId,
      body: input.body,
      visibility: input.visibility ?? 'staff',
      isPinned: input.isPinned ?? false,
    });
    await audit(ctx, input.entityType, 'note', input.entityId, { summary: 'Added a note' });
    return (await toNotes(ctx, [row]))[0] as Note;
  },

  async update(ctx: Ctx, id: string, input: UpdateNote): Promise<Note> {
    assertPermission(ctx, 'notes:create');
    await ownNote(ctx, id);
    const { version, ...changes } = input;
    const row = await notesDb.update(ctx, id, changes, version);
    return (await toNotes(ctx, [row]))[0] as Note;
  },

  async remove(ctx: Ctx, id: string): Promise<void> {
    assertPermission(ctx, 'notes:create');
    const row = await ownNote(ctx, id);
    await notesDb.remove(ctx, id);
    await audit(ctx, row.entityType, 'note', row.entityId, { summary: 'Deleted a note' });
  },
};

const toView = (row: typeof savedViews.$inferSelect): SavedView => ({
  id: row.id,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  listKey: row.listKey,
  name: row.name,
  filters: (row.filters ?? {}) as Record<string, unknown>,
  isDefault: row.isDefault,
});

const mine = (ctx: Ctx) => and(eq(savedViews.userId, ctx.actor.userId), isNull(savedViews.deletedAt));

/** One default for each list: making a view the default takes the mark off the others. */
async function clearDefault(ctx: Ctx, listKey: string, keepId: string): Promise<void> {
  const others = await ctx.db
    .select({ id: savedViews.id })
    .from(savedViews)
    .where(
      and(mine(ctx), eq(savedViews.listKey, listKey), eq(savedViews.isDefault, true), ne(savedViews.id, keepId)),
    );
  for (const other of others) await viewsDb.update(ctx, other.id, { isDefault: false });
}

async function ownView(ctx: Ctx, id: string) {
  const row = await viewsDb.find(ctx, id, eq(savedViews.userId, ctx.actor.userId));
  if (!row) throw notFound('Saved view');
  return row;
}

export const savedViewsService = {
  /** One's own views of a list: the default first, then by name. */
  async list(ctx: Ctx, query: ListSavedViews): Promise<SavedView[]> {
    const rows = await ctx.db
      .select()
      .from(savedViews)
      .where(and(mine(ctx), eq(savedViews.listKey, query.listKey)))
      .orderBy(desc(savedViews.isDefault), asc(savedViews.name), asc(savedViews.id));
    return rows.map(toView);
  },

  async create(ctx: Ctx, input: CreateSavedView): Promise<SavedView> {
    const held = await viewsDb.count(
      ctx,
      and(eq(savedViews.userId, ctx.actor.userId), eq(savedViews.listKey, input.listKey)),
    );
    if (held >= MAX_SAVED_VIEWS)
      throw rule(
        `You have ${MAX_SAVED_VIEWS} saved views of this list, which is the most. Delete one first.`,
      );
    const row = await viewsDb.insert(ctx, {
      userId: ctx.actor.userId,
      listKey: input.listKey,
      name: input.name,
      filters: input.filters as never,
      isDefault: input.isDefault ?? false,
    });
    if (row.isDefault) await clearDefault(ctx, row.listKey, row.id);
    return toView(row);
  },

  async update(ctx: Ctx, id: string, input: UpdateSavedView): Promise<SavedView> {
    await ownView(ctx, id);
    const { version, filters, ...rest } = input;
    const row = await viewsDb.update(
      ctx,
      id,
      { ...rest, ...(filters !== undefined && { filters: filters as never }) },
      version,
    );
    if (input.isDefault) await clearDefault(ctx, row.listKey, row.id);
    return toView(row);
  },

  async remove(ctx: Ctx, id: string): Promise<void> {
    await ownView(ctx, id);
    await viewsDb.remove(ctx, id);
  },
};
