import { roomsContract } from '@takhti/contracts';
import type { Ctx } from '../../kernel/context';
import { createCrudService } from '../../kernel/crud-service';
import { registerConstraintMessages, rule } from '../../kernel/errors';
import { assertBranchOpen } from './branches.service';
import { roomsDb } from './rooms.db-service';

/* Layer 4 for rooms. Rules: docs/plan/10-modules/m02-organisation-branches.md, section 5. */

registerConstraintMessages({
  rooms_name_uq: { message: 'This branch already has a room with this name', field: 'name' },
});

/**
 * Something that uses a room: a section, a timetable entry, a future booking.
 * The module that owns the using record registers the check; it returns a sentence, or nothing.
 */
export type RoomUse = (ctx: Ctx, roomId: string) => Promise<string | undefined>;

const uses: RoomUse[] = [];

export function registerRoomUse(use: RoomUse): void {
  uses.push(use);
}

export const roomsService = createCrudService({
  contract: roomsContract,
  db: roomsDb,
  // One permission covers creating, changing and deleting a room.
  actions: { create: 'update', update: 'update', delete: 'update' },
  summary: (row, action) =>
    action === 'create'
      ? `Added room ${row.name}`
      : action === 'delete'
        ? `Deleted room ${row.name}`
        : `Changed room ${row.name}`,
  rules: {
    beforeCreate: (ctx, input) => assertBranchOpen(ctx, input.branchId),
    beforeUpdate: (ctx, current) => assertBranchOpen(ctx, current.branchId),
    async beforeRemove(ctx, current) {
      await assertBranchOpen(ctx, current.branchId);
      // R-org-10: a room in use cannot be deleted.
      const reasons = (await Promise.all(uses.map((use) => use(ctx, current.id)))).filter(
        (reason): reason is string => Boolean(reason),
      );
      if (reasons.length > 0) throw rule(`This room is in use: ${reasons.join('; ')}`);
    },
  },
});
