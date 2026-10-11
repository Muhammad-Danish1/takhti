// Proves what the compiler catches. This file is never run; `pnpm typecheck` reads it.
// Each @ts-expect-error must really be an error: if the mistake below it ever compiled,
// TypeScript would report "Unused '@ts-expect-error' directive" and the type-check would fail.
import { z } from 'zod';
import { roomsApi } from '@takhti/api-client';
import {
  CreateRoom,
  defineResource,
  roomsContract,
  type ListRoomsParams,
  type PermissionKey,
} from '@takhti/contracts';
import {
  assertPermission,
  createCrudService,
  createDbService,
  enqueue,
  defineJob,
  emit,
  getSetting,
  roomsDb,
  roomsService,
  type Ctx,
} from '@takhti/core';
import { defineEvent, defineSetting, securitySessionHours } from '@takhti/contracts';
import { rooms } from '@takhti/db';
import { useCreateRoom, useRooms, useUpdateRoom } from '@takhti/hooks';

declare const ctx: Ctx;

// 1. A sortable name in the contract with no column in the db-service: the contract and the query cannot drift.
createDbService<typeof rooms, ListRoomsParams>(rooms, {
  label: 'Room',
  // @ts-expect-error "createdAt" is sortable in the contract and missing here
  sort: { name: rooms.name, kind: rooms.kind, capacity: rooms.capacity },
});

// 2. A contract whose create body does not fit the table must supply a mapper.
const misfit = defineResource({
  ...roomsContract,
  create: CreateRoom.extend({ kind: z.string() }),
});
// @ts-expect-error toInsert is required: `kind` is any text here, and the table allows eight values
createCrudService({ contract: misfit, db: roomsDb });
// ...and is accepted once the mapper says how the two meet.
createCrudService({
  contract: misfit,
  db: roomsDb,
  toInsert: (input) => ({
    ...input,
    kind: input.kind === 'lab' ? ('lab' as const) : ('classroom' as const),
  }),
});

// 3. The API client knows every filter, sort name and required field.
void roomsApi.list({ kind: 'lab', page: 2, sort: 'capacity' });
// @ts-expect-error not a kind of room
void roomsApi.list({ kind: 'dungeon' });
// @ts-expect-error not a filter of this list
void roomsApi.list({ colour: 'blue' });
// @ts-expect-error not a sortable column
void roomsApi.list({ sort: 'floor' });
// @ts-expect-error the branch is required
void roomsApi.create({ name: 'Room 1' });
// @ts-expect-error version is required on every update
void roomsApi.update('id', { name: 'Room 2' });

// 4. Service and db-service results.
export async function serverTypes() {
  const page = await roomsService.list(ctx, { page: 1, pageSize: 25, sort: 'name', order: 'asc' });
  const room = page.items[0];
  const name: string | undefined = room?.name;
  // @ts-expect-error orgId is not part of what the API returns
  void room?.orgId;
  // @ts-expect-error nor is deletedAt
  void room?.deletedAt;

  const row = await roomsDb.get(ctx, 'id');
  const orgId: string = row.orgId;
  const kind: 'classroom' | 'lab' | 'library' | 'hall' | 'office' | 'clinic' | 'store' | 'other' =
    row.kind;
  // @ts-expect-error a patch cannot touch a column the kernel maintains
  await roomsDb.update(ctx, 'id', { orgId: 'other' });
  // @ts-expect-error nor the version
  await roomsDb.update(ctx, 'id', { version: 9 });
  // @ts-expect-error not a column
  await roomsDb.update(ctx, 'id', { nickname: 'x' });
  // @ts-expect-error not an allowed value
  await roomsDb.update(ctx, 'id', { kind: 'dungeon' });
  return { name, orgId, kind };
}

// 5. Permissions, settings, jobs and events are typed by what was declared.
export async function kernelTypes() {
  const held: PermissionKey = 'rooms:update';
  assertPermission(ctx, held);
  // @ts-expect-error not a permission in the catalogue
  assertPermission(ctx, 'rooms:demolish');

  const hours: number = await getSetting(ctx, securitySessionHours);
  // @ts-expect-error this setting is a number, not text
  const wrong: string = await getSetting(ctx, securitySessionHours);
  defineSetting({
    key: 'tests.flag',
    scope: 'org',
    schema: z.boolean(),
    // @ts-expect-error a default that does not fit the schema
    default: 'yes',
    label: 'Flag',
  });

  const job = defineJob({
    name: 'tests.typed',
    payload: z.object({ roomId: z.uuid() }),
    handler: async () => {},
  });
  await enqueue(ctx, job, { roomId: 'id' });
  // @ts-expect-error the payload does not fit the job
  await enqueue(ctx, job, { room: 'id' });

  const event = defineEvent({
    key: 'tests.typed',
    category: 'system',
    payload: z.object({ amount: z.int() }),
    variables: [],
    rules: [],
  });
  await emit(ctx, event, { amount: 100 });
  // @ts-expect-error the payload does not fit the event
  await emit(ctx, event, { amount: 'a hundred' });
  return { hours, wrong };
}

// 6. Hooks.
export function hookTypes() {
  const list = useRooms({ kind: 'lab', sort: 'capacity' });
  const total: number | undefined = list.data?.total;
  const firstName: string | undefined = list.data?.items[0]?.name;

  // @ts-expect-error not a sortable field
  useRooms({ sort: 'floor' });

  const create = useCreateRoom();
  // @ts-expect-error the branch is required
  create.mutate({ name: 'Room 1' });

  const update = useUpdateRoom();
  update.mutate({ id: 'x', version: 3, name: 'New name' });
  // @ts-expect-error version is required on every update
  update.mutate({ id: 'x', name: 'New name' });
  return { total, firstName };
}
