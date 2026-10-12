import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MAX_SAVED_VIEWS,
  type CustomField,
  type Note,
  type Page,
  type SavedView,
} from '@takhti/contracts';
import { customFieldsService, type Actor } from '@takhti/core';
import { adminDb, customFieldDefs, notes, rooms } from '@takhti/db';
import * as fieldItem from '../../../apps/web/app/api/v1/custom-fields/[id]/route';
import * as fieldList from '../../../apps/web/app/api/v1/custom-fields/route';
import * as noteItem from '../../../apps/web/app/api/v1/notes/[id]/route';
import * as noteList from '../../../apps/web/app/api/v1/notes/route';
import * as viewItem from '../../../apps/web/app/api/v1/saved-views/[id]/route';
import * as viewList from '../../../apps/web/app/api/v1/saved-views/route';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, expectError, seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

/*
 * Custom fields, staff notes and saved views through their routes.
 * Rules and tests: docs/plan/10-modules/m00-shared-kernel.md.
 */

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let principal: Actor;
let cityPrincipal: Actor;
let teacher: Actor;
let coordinator: Actor;
let guardian: Actor;
let outsider: Actor;
let roomId: string;

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  other = await seedOrg();
  principal = await school.actor('principal');
  cityPrincipal = await school.actor('principal', { branch: 'city' });
  teacher = await school.actor('class_teacher');
  coordinator = await school.actor('coordinator');
  guardian = await school.actor('guardian');
  outsider = await other.actor('principal');
  roomId = randomUUID();
  await adminDb()
    .insert(rooms)
    .values({
      id: roomId,
      orgId: school.orgId,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
      branchId: school.mainBranchId,
      name: 'Staff room',
    });
});
afterAll(async () => {
  await db.destroy();
});

describe('custom fields', () => {
  const add = (actor: Actor, body: unknown) =>
    callRoute<CustomField>(fieldList.POST, {
      as: actor,
      method: 'POST',
      url: '/api/v1/custom-fields',
      body,
    });
  const list = (actor: Actor, query = '') =>
    callRoute<Page<CustomField>>(fieldList.GET, {
      as: actor,
      url: `/api/v1/custom-fields${query}`,
    });

  it('a field is added to one kind of record, listed in its order, changed, and switched off rather than deleted', async () => {
    const house = await add(principal, {
      entity: 'student',
      key: 'house_colour',
      fieldType: 'select',
      label: 'House colour',
      labelUr: 'ہاؤس کا رنگ',
      options: ['Red', 'Blue'],
      sortOrder: 2,
    });
    expect(house.status).toBe(201);
    expect(house.data).toMatchObject({
      entity: 'student',
      key: 'house_colour',
      fieldType: 'select',
      options: ['Red', 'Blue'],
      isRequired: false,
      isActive: true,
    });
    await add(principal, {
      entity: 'student',
      key: 'hifz_status',
      fieldType: 'text',
      label: 'Hifz status',
      isRequired: true,
      sortOrder: 1,
    });
    await add(principal, { entity: 'staff', key: 'shirt_size', fieldType: 'text', label: 'Shirt size' });

    // Every member of staff may read them: the forms need them.
    const forStudents = await list(teacher, '?entity=student');
    expect(forStudents.data.items.map((item) => item.key)).toEqual(['hifz_status', 'house_colour']);

    const changed = await callRoute<CustomField>(fieldItem.PATCH, {
      as: principal,
      method: 'PATCH',
      url: '/x',
      params: { id: house.data.id },
      body: { version: 1, options: ['Red', 'Blue', 'Green'], isRequired: true },
    });
    expect(changed.data).toMatchObject({ options: ['Red', 'Blue', 'Green'], isRequired: true, version: 2 });

    const off = await callRoute<CustomField>(fieldItem.DELETE, {
      as: principal,
      method: 'DELETE',
      url: '/x',
      params: { id: house.data.id },
    });
    expect(off.status).toBe(200);
    expect(off.data.isActive).toBe(false);
    const [row] = await adminDb()
      .select()
      .from(customFieldDefs)
      .where(eq(customFieldDefs.id, house.data.id));
    expect(row).toMatchObject({ isActive: false, deletedAt: null });
    expect((await list(teacher, '?entity=student&isActive=true')).data.items.map((item) => item.key)).toEqual([
      'hifz_status',
    ]);
  });

  it('a key is unique for its kind of record; a list needs choices and nothing else has them; its key and type are fixed', async () => {
    const twice = await add(principal, {
      entity: 'student',
      key: 'hifz_status',
      fieldType: 'text',
      label: 'Hifz again',
    });
    expect(twice.status).toBe(409);
    expect(twice.error?.fields).toEqual({ key: ['There is already a field with this key'] });
    // The same key on another kind of record is another field.
    expect(
      (await add(principal, { entity: 'guardian', key: 'hifz_status', fieldType: 'text', label: 'Hifz' }))
        .status,
    ).toBe(201);

    const noChoices = await add(principal, {
      entity: 'student',
      key: 'blood_camp',
      fieldType: 'select',
      label: 'Blood camp',
    });
    expect(noChoices.error?.fields).toEqual({ options: ['Give the choices of this list'] });
    const strayChoices = await add(principal, {
      entity: 'student',
      key: 'nickname',
      fieldType: 'text',
      label: 'Nickname',
      options: ['a'],
    });
    expect(strayChoices.error?.fields).toEqual({ options: ['Only a list has choices'] });
    expect(
      (await add(principal, { entity: 'student', key: 'Bad Key', fieldType: 'text', label: 'Bad' })).status,
    ).toBe(422);

    const [field] = (await list(principal, '?entity=staff')).data.items;
    const retyped = await callRoute<CustomField>(fieldItem.PATCH, {
      as: principal,
      method: 'PATCH',
      url: '/x',
      params: { id: field!.id },
      body: { version: field!.version, key: 'other_key', fieldType: 'number', label: 'Shirt' },
    });
    // What cannot change is simply not part of what a change may carry.
    expect(retyped.data).toMatchObject({ key: 'shirt_size', fieldType: 'text', label: 'Shirt' });
  });

  it('only those who may manage custom fields change them, and another school has its own', async () => {
    expect(
      (await add(teacher, { entity: 'student', key: 'x_field', fieldType: 'text', label: 'X field' })).status,
    ).toBe(403);
    expect((await list(guardian)).status).toBe(403);
    expect((await list(outsider)).data.items).toEqual([]);
  });

  it('T-shared-10 / R-shared-10 a record with custom fields is checked against the school’s active definitions', async () => {
    const good = await as(principal, (ctx) =>
      customFieldsService.validate(ctx, 'student', {
        hifz_status: 'Nazra complete',
        house_colour: 'Purple',
        unknown: 'x',
      }),
    );
    // The house colour was switched off above: it is neither checked nor kept.
    expect(good).toEqual({ hifz_status: 'Nazra complete' });
    const error = await expectError('VALIDATION', () =>
      as(principal, (ctx) => customFieldsService.validate(ctx, 'student', {})),
    );
    expect(error.fields).toEqual({ 'custom.hifz_status': ['Hifz status is required'] });
    // Another kind of record has other fields.
    expect(await as(principal, (ctx) => customFieldsService.validate(ctx, 'admission', {}))).toEqual({});
  });
});

describe('notes', () => {
  const add = (actor: Actor, body: Record<string, unknown>) =>
    callRoute<Note>(noteList.POST, {
      as: actor,
      method: 'POST',
      url: '/api/v1/notes',
      body: { entityType: 'rooms', entityId: roomId, ...body },
    });
  const list = (actor: Actor, entityId = roomId) =>
    callRoute<Note[]>(noteList.GET, {
      as: actor,
      url: `/api/v1/notes?entityType=rooms&entityId=${entityId}`,
    });
  const change = (actor: Actor, id: string, body: unknown) =>
    callRoute<Note>(noteItem.PATCH, { as: actor, method: 'PATCH', url: '/x', params: { id }, body });
  const remove = (actor: Actor, id: string) =>
    callRoute(noteItem.DELETE, { as: actor, method: 'DELETE', url: '/x', params: { id } });

  it('staff write notes on a record they can open; pinned notes come first, then the newest', async () => {
    const first = await add(teacher, { body: 'The projector bulb needs replacing.' });
    expect(first.status).toBe(201);
    expect(first.data).toMatchObject({
      body: 'The projector bulb needs replacing.',
      visibility: 'staff',
      isPinned: false,
      authorName: 'Nadia Hussain',
      mine: true,
    });
    const pinned = await add(principal, { body: 'Not to be booked on Fridays.', isPinned: true });
    const listed = await list(coordinator);
    expect(listed.data.map((note) => note.id).slice(0, 2)).toEqual([pinned.data.id, first.data.id]);
    expect(listed.data.every((note) => note.mine === false)).toBe(true);
    expect((await add(teacher, { body: '   ' })).status).toBe(422);
  });

  it('a note for leaders is read by the leaders of the school and by its author, and by nobody else', async () => {
    const quiet = await add(coordinator, {
      body: 'Budget for new furniture is under discussion.',
      visibility: 'leaders',
    });
    const seenBy = async (actor: Actor) =>
      (await list(actor)).data.map((note) => note.id).includes(quiet.data.id);
    expect(await seenBy(principal)).toBe(true);
    expect(await seenBy(coordinator)).toBe(true);
    expect(await seenBy(teacher)).toBe(false);
    // To someone who cannot see it, it does not exist.
    expect((await change(teacher, quiet.data.id, { version: 1, body: 'x' })).status).toBe(404);
    expect((await remove(teacher, quiet.data.id)).status).toBe(404);
  });

  it('only the person who wrote a note changes or deletes it', async () => {
    const mine = await add(teacher, { body: 'Whiteboard markers are in the top drawer.' });
    const edited = await change(teacher, mine.data.id, { version: 1, body: 'Markers are in the cupboard.', isPinned: true });
    expect(edited.data).toMatchObject({ body: 'Markers are in the cupboard.', isPinned: true, version: 2 });
    expect((await change(principal, mine.data.id, { version: 2, body: 'x' })).status).toBe(403);
    expect((await remove(principal, mine.data.id)).status).toBe(403);
    expect((await change(teacher, mine.data.id, { version: 1, body: 'stale' })).status).toBe(409);
    expect((await remove(teacher, mine.data.id)).status).toBe(204);
    const [row] = await adminDb().select().from(notes).where(eq(notes.id, mine.data.id));
    expect(row?.deletedAt).not.toBeNull();
  });

  it('notes follow the record: someone who cannot open the record cannot read or write its notes', async () => {
    expect((await list(cityPrincipal)).status).toBe(404);
    expect((await add(cityPrincipal, { body: 'x note' })).status).toBe(404);
    expect((await list(outsider)).status).toBe(404);
    expect((await list(principal, randomUUID())).status).toBe(404);
    expect((await list(guardian)).status).toBe(403);
    expect(
      (
        await callRoute(noteList.GET, {
          as: principal,
          url: `/api/v1/notes?entityType=spaceships&entityId=${roomId}`,
        })
      ).status,
    ).toBe(404);
  });
});

describe('saved views', () => {
  const save = (actor: Actor, body: Record<string, unknown>) =>
    callRoute<SavedView>(viewList.POST, {
      as: actor,
      method: 'POST',
      url: '/api/v1/saved-views',
      body: { listKey: 'students', filters: { status: 'active' }, ...body },
    });
  const list = (actor: Actor, listKey = 'students') =>
    callRoute<SavedView[]>(viewList.GET, {
      as: actor,
      url: `/api/v1/saved-views?listKey=${listKey}`,
    });
  const change = (actor: Actor, id: string, body: unknown) =>
    callRoute<SavedView>(viewItem.PATCH, { as: actor, method: 'PATCH', url: '/x', params: { id }, body });

  it('a person saves the filters of a list under a name and has one default for each list', async () => {
    const all = await save(teacher, { name: 'My class' });
    expect(all.status).toBe(201);
    expect(all.data).toMatchObject({ listKey: 'students', name: 'My class', isDefault: false });
    const absent = await save(teacher, {
      name: 'Absent this week',
      filters: { attendance: 'absent', range: 'this-week' },
      isDefault: true,
    });
    expect((await list(teacher)).data.map((view) => [view.name, view.isDefault])).toEqual([
      ['Absent this week', true],
      ['My class', false],
    ]);

    // Making another the default takes the mark off the first.
    const now = await change(teacher, all.data.id, { version: 1, isDefault: true, name: 'Class 5-A' });
    expect(now.data).toMatchObject({ name: 'Class 5-A', isDefault: true });
    expect((await list(teacher)).data.map((view) => [view.name, view.isDefault])).toEqual([
      ['Class 5-A', true],
      ['Absent this week', false],
    ]);
    // A view of another list is not touched.
    await save(teacher, { listKey: 'fee-vouchers.defaulters', name: 'Over 60 days', isDefault: true });
    expect((await list(teacher)).data.filter((view) => view.isDefault)).toHaveLength(1);
    expect(absent.status).toBe(201);
  });

  it('a view is its owner’s alone, for families as for staff', async () => {
    const mine = await save(guardian, { listKey: 'family.notices', name: 'Unread' });
    expect(mine.status).toBe(201);
    expect((await list(guardian, 'family.notices')).data).toHaveLength(1);
    expect((await list(teacher, 'family.notices')).data).toEqual([]);
    expect((await change(principal, mine.data.id, { version: 1, name: 'Mine now' })).status).toBe(404);
    const remove = (actor: Actor) =>
      callRoute(viewItem.DELETE, {
        as: actor,
        method: 'DELETE',
        url: '/x',
        params: { id: mine.data.id },
      });
    expect((await remove(principal)).status).toBe(404);
    expect((await remove(guardian)).status).toBe(204);
    expect((await list(guardian, 'family.notices')).data).toEqual([]);
  });

  it('there is a limit to how many views one person keeps for one list', async () => {
    for (let index = 0; index < MAX_SAVED_VIEWS; index++)
      expect((await save(coordinator, { name: `View ${index + 1}` })).status).toBe(201);
    const over = await save(coordinator, { name: 'One too many' });
    expect(over.status).toBe(409);
    expect(over.error?.message).toBe(
      `You have ${MAX_SAVED_VIEWS} saved views of this list, which is the most. Delete one first.`,
    );
    expect((await save(coordinator, { listKey: 'staff', name: 'Another list' })).status).toBe(201);
    expect((await save(coordinator, { listKey: 'Not A List', name: 'x view' })).status).toBe(422);
  });
});
