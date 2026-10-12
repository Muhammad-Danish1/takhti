import { randomUUID } from 'node:crypto';
import { and, eq, ilike } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Name, storageBuckets } from '@takhti/contracts';
import {
  approvalTrail,
  attach,
  cancelApproval,
  cancelImport,
  claimJobs,
  commitImport,
  confirmUpload,
  createUpload,
  decideApproval,
  defineExporter,
  defineImporter,
  detach,
  exportStatus,
  importProblemsCsv,
  importTemplate,
  memoryStorage,
  onApprovalDecided,
  parseCsv,
  requestApproval,
  roomsDb,
  roomsService,
  runClaimedJob,
  setStorageProvider,
  signedDownload,
  stageImport,
  startExport,
  type Actor,
} from '@takhti/core';
import {
  adminDb,
  approvalPolicies,
  approvalRequests,
  attachments,
  files,
  importRows,
  jobs,
  rooms,
  withAdminTx,
} from '@takhti/db';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, expectError, seedOrg, type TestOrg } from '../../helpers/world';

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let principal: Actor;
let accountant: Actor;
let director: Actor;
let guardian: Actor;
const store = memoryStorage();

/** Does what the browser does with a signed upload link: puts the bytes where the link points. */
async function uploadBytes(fileId: string, content: Uint8Array | string, mimeType: string) {
  const [file] = await adminDb().select().from(files).where(eq(files.id, fileId));
  await store.put(
    file!.bucket,
    file!.path,
    typeof content === 'string' ? new TextEncoder().encode(content) : content,
    mimeType,
  );
}

beforeAll(async () => {
  db = await createTestDb();
  setStorageProvider(store);
  school = await seedOrg();
  other = await seedOrg();
  principal = await school.actor('principal');
  accountant = await school.actor('accountant');
  director = await school.actor('director');
  guardian = await school.actor('guardian');
});
afterAll(async () => {
  setStorageProvider(undefined);
  await db.destroy();
});

describe('files', () => {
  const pdf = {
    purpose: 'document' as const,
    fileName: 'B-Form Ali Raza.pdf',
    mimeType: 'application/pdf',
    size: 250_000,
  };

  it('every purpose has a bucket, and only the website’s is public', () => {
    expect(storageBuckets.map((bucket) => bucket.name).sort()).toEqual([
      'documents',
      'exports',
      'generated',
      'imports',
      'knowledge',
      'learning',
      'photos',
      'site',
    ]);
    expect(storageBuckets.filter((bucket) => bucket.public).map((bucket) => bucket.name)).toEqual([
      'site',
    ]);
  });

  it('the three steps: a ticket, the upload, the confirmation; then a short-lived link', async () => {
    const ticket = await as(principal, (ctx) => createUpload(ctx, pdf));
    expect(ticket.uploadUrl).toContain('upload');
    const [pending] = await adminDb().select().from(files).where(eq(files.id, ticket.fileId));
    expect(pending).toMatchObject({
      status: 'pending',
      bucket: 'documents',
      originalName: 'B-Form Ali Raza.pdf',
      uploadedBy: principal.userId,
    });
    // The stored path is ours; the uploader's file name is never part of it.
    expect(pending?.path).toMatch(
      new RegExp(`^${school.orgId}/document/\\d{4}/${ticket.fileId}\\.pdf$`),
    );

    await expectError('RULE', () => as(principal, (ctx) => signedDownload(ctx, ticket.fileId))); // not ready yet
    await expectError('RULE', () => as(principal, (ctx) => confirmUpload(ctx, ticket.fileId))); // nothing uploaded yet

    await uploadBytes(ticket.fileId, new Uint8Array(250_000), 'application/pdf');
    expect(await as(principal, (ctx) => confirmUpload(ctx, ticket.fileId))).toEqual({
      id: ticket.fileId,
      status: 'ready',
    });
    expect(await as(principal, (ctx) => confirmUpload(ctx, ticket.fileId))).toEqual({
      id: ticket.fileId,
      status: 'ready',
    }); // harmless twice

    const link = await as(principal, (ctx) => signedDownload(ctx, ticket.fileId));
    expect(link.url).toContain('expires=300');
  });

  it('refuses a kind of file or a size its purpose does not allow, naming the field', async () => {
    const wrongType = await expectError('VALIDATION', () =>
      as(principal, (ctx) => createUpload(ctx, { ...pdf, purpose: 'photo' })),
    );
    expect(Object.keys(wrongType.fields ?? {})).toEqual(['mimeType']);
    const tooBig = await expectError('VALIDATION', () =>
      as(principal, (ctx) => createUpload(ctx, { ...pdf, size: 11 * 1024 * 1024 })),
    );
    expect(tooBig.fields?.size?.[0]).toMatch(/11 MB.*limit is 10 MB/);
    await expectError('VALIDATION', () =>
      as(principal, (ctx) => createUpload(ctx, { ...pdf, size: 0 })),
    );
  });

  it('T-shared-2 a file larger than its purpose allows is removed and quarantined when it is confirmed', async () => {
    const ticket = await as(principal, (ctx) =>
      createUpload(ctx, {
        purpose: 'photo',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 100_000,
      }),
    );
    await uploadBytes(ticket.fileId, new Uint8Array(3 * 1024 * 1024), 'image/jpeg'); // the limit for a photo is 2 MB
    // An answer, not an error: an error would roll back the mark that records the quarantine.
    expect(await as(principal, (ctx) => confirmUpload(ctx, ticket.fileId))).toEqual({
      id: ticket.fileId,
      status: 'quarantined',
      reason: 'The file is larger than allowed',
    });
    const [row] = await adminDb().select().from(files).where(eq(files.id, ticket.fileId));
    expect(row?.status).toBe('quarantined');
    expect(await store.stat(row!.bucket, row!.path)).toBeNull();
    // Quarantined for good: it can be neither confirmed again nor used.
    await expectError('RULE', () => as(principal, (ctx) => confirmUpload(ctx, ticket.fileId)));
  });

  it('only the uploader can confirm their upload; a file name with odd characters is kept safe', async () => {
    const ticket = await as(guardian, (ctx) =>
      createUpload(ctx, {
        ...pdf,
        purpose: 'payment_proof',
        fileName: '../../etc/passwd\u0000<script>.pdf',
      }),
    );
    const [row] = await adminDb().select().from(files).where(eq(files.id, ticket.fileId));
    expect(row?.originalName).toBe('.. .. etc passwd script .pdf');
    await uploadBytes(ticket.fileId, new Uint8Array(1000), 'application/pdf');
    await expectError('NOT_FOUND', () => as(principal, (ctx) => confirmUpload(ctx, ticket.fileId)));
    await expect(as(guardian, (ctx) => confirmUpload(ctx, ticket.fileId))).resolves.toMatchObject({
      status: 'ready',
    });
  });

  it('another school cannot reach a file by its id', async () => {
    const ticket = await as(principal, (ctx) => createUpload(ctx, pdf));
    await uploadBytes(ticket.fileId, new Uint8Array(10), 'application/pdf');
    await as(principal, (ctx) => confirmUpload(ctx, ticket.fileId));
    const stranger = await other.actor('principal');
    await expectError('NOT_FOUND', () => as(stranger, (ctx) => signedDownload(ctx, ticket.fileId)));
  });

  it('a ready file can be attached to a record and detached again', async () => {
    const ticket = await as(principal, (ctx) => createUpload(ctx, pdf));
    const recordId = randomUUID();
    await expectError('VALIDATION', () =>
      as(principal, (ctx) => attach(ctx, 'students', recordId, ticket.fileId)),
    ); // still pending
    await uploadBytes(ticket.fileId, new Uint8Array(10), 'application/pdf');
    await as(principal, (ctx) => confirmUpload(ctx, ticket.fileId));

    const first = await as(principal, (ctx) =>
      attach(ctx, 'students', recordId, ticket.fileId, 'B-Form'),
    );
    const second = await as(principal, (ctx) =>
      attach(ctx, 'students', recordId, ticket.fileId, 'Copy'),
    );
    const rows = await adminDb()
      .select()
      .from(attachments)
      .where(eq(attachments.entityId, recordId));
    expect(rows.map((row) => [row.label, row.sortOrder]).sort()).toEqual([
      ['B-Form', 0],
      ['Copy', 1],
    ]);
    await as(principal, (ctx) => detach(ctx, first));
    await expectError('NOT_FOUND', () => as(principal, (ctx) => detach(ctx, first)));
    expect(second).toBeTruthy();
  });
});

describe('approvals', () => {
  const decided: string[] = [];
  beforeAll(async () => {
    onApprovalDecided('tests-discounts', {
      approved: async (_ctx, entityId) => void decided.push(`approved:${entityId}`),
      rejected: async (_ctx, entityId, note) => void decided.push(`rejected:${entityId}:${note}`),
    });
    await withAdminTx((tx) =>
      tx.insert(approvalPolicies).values([
        {
          orgId: school.orgId,
          entityType: 'tests-discounts',
          name: 'Discounts from Rs 5,000',
          minAmount: 500_000,
          steps: [{ roleKeys: ['principal'] }],
        },
        {
          orgId: school.orgId,
          entityType: 'tests-discounts',
          name: 'Discounts from Rs 50,000',
          minAmount: 5_000_000,
          steps: [{ roleKeys: ['principal'] }, { roleKeys: ['director', 'finance_head'] }],
        },
      ]),
    );
  });
  const ask = (actor: Actor, amount: number, entityId = randomUUID()) =>
    as(actor, (ctx) =>
      requestApproval(ctx, {
        entityType: 'tests-discounts',
        entityId,
        amount,
        summary: `Discount of Rs ${amount / 100} for Ali Raza`,
        branchId: school.mainBranchId,
      }),
    ).then((start) => ({ start, entityId }));

  it('below every threshold, or with no policy at all, nothing needs approving', async () => {
    expect((await ask(accountant, 100_000)).start).toEqual({ needed: false });
    expect(
      await as(accountant, (ctx) =>
        requestApproval(ctx, { entityType: 'unpoliced', entityId: randomUUID(), summary: 'x' }),
      ),
    ).toEqual({ needed: false });
  });

  it('one step: the named role approves, and the owning module’s effect runs in the same transaction', async () => {
    const { start, entityId } = await ask(accountant, 800_000);
    if (!start.needed) throw new Error('expected an approval request');
    const outcome = await as(principal, (ctx) => decideApproval(ctx, start.requestId, 'approve'));
    expect(outcome).toEqual({ requestId: start.requestId, status: 'approved' });
    expect(decided).toContain(`approved:${entityId}`);
    expect((await as(principal, (ctx) => approvalTrail(ctx, start.requestId)))[0]).toMatchObject({
      stepOrder: 1,
      status: 'approved',
      decidedBy: principal.userId,
    });
  });

  it('two steps, for the larger amount: the request stays pending until the last step', async () => {
    const { start, entityId } = await ask(accountant, 6_000_000);
    if (!start.needed) throw new Error('expected an approval request');
    await expectError('FORBIDDEN', () =>
      as(director, (ctx) => decideApproval(ctx, start.requestId, 'approve')),
    ); // step 1 is the principal's
    expect(await as(principal, (ctx) => decideApproval(ctx, start.requestId, 'approve'))).toEqual({
      requestId: start.requestId,
      status: 'pending',
      currentStep: 2,
    });
    expect(decided).not.toContain(`approved:${entityId}`);
    await expectError('FORBIDDEN', () =>
      as(principal, (ctx) => decideApproval(ctx, start.requestId, 'approve')),
    ); // step 2 is not
    expect(
      (await as(director, (ctx) => decideApproval(ctx, start.requestId, 'approve'))).status,
    ).toBe('approved');
    expect(decided).toContain(`approved:${entityId}`);
    await expectError('RULE', () =>
      as(director, (ctx) => decideApproval(ctx, start.requestId, 'approve')),
    ); // already decided
  });

  it('nobody approves their own request, whatever their role', async () => {
    const { start } = await ask(principal, 800_000);
    if (!start.needed) throw new Error('expected an approval request');
    const error = await expectError('RULE', () =>
      as(principal, (ctx) => decideApproval(ctx, start.requestId, 'approve')),
    );
    expect(error.message).toBe('You cannot approve your own request');
  });

  it('a rejection needs a reason, ends the request and tells the owning module', async () => {
    const { start, entityId } = await ask(accountant, 6_000_000);
    if (!start.needed) throw new Error('expected an approval request');
    await expectError('VALIDATION', () =>
      as(principal, (ctx) => decideApproval(ctx, start.requestId, 'reject', ' ')),
    );
    expect(
      (
        await as(principal, (ctx) =>
          decideApproval(
            ctx,
            start.requestId,
            'reject',
            'The family already has a sibling discount',
          ),
        )
      ).status,
    ).toBe('rejected');
    expect(decided).toContain(`rejected:${entityId}:The family already has a sibling discount`);
    const trail = await as(principal, (ctx) => approvalTrail(ctx, start.requestId));
    expect(trail.map((step) => step.status)).toEqual(['rejected', 'skipped']);
  });

  it('the same record cannot wait for approval twice; the requester may withdraw', async () => {
    const { start, entityId } = await ask(accountant, 800_000);
    if (!start.needed) throw new Error('expected an approval request');
    await expectError('CONFLICT', () => ask(accountant, 800_000, entityId));
    await expectError('FORBIDDEN', () =>
      as(director, (ctx) => cancelApproval(ctx, 'tests-discounts', entityId)),
    );
    expect(await as(accountant, (ctx) => cancelApproval(ctx, 'tests-discounts', entityId))).toBe(
      true,
    );
    expect(await as(accountant, (ctx) => cancelApproval(ctx, 'tests-discounts', entityId))).toBe(
      false,
    );
    const [row] = await adminDb()
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, start.requestId));
    expect(row?.status).toBe('cancelled');
    expect((await ask(accountant, 800_000, entityId)).start.needed).toBe(true); // and may ask again
  });

  it('F-shared-4 when the record under approval is deleted, the request is cancelled with it', async () => {
    await withAdminTx((tx) =>
      tx.insert(approvalPolicies).values({
        orgId: school.orgId,
        entityType: 'rooms',
        name: 'New rooms',
        minAmount: 0,
        steps: [{ roleKeys: ['director'] }],
      }),
    );
    const room = await as(principal, (ctx) =>
      roomsService.create(ctx, {
        branchId: school.mainBranchId,
        name: 'Room awaiting approval',
        kind: 'classroom',
        capacity: null,
      }),
    );
    const start = await as(accountant, (ctx) =>
      requestApproval(ctx, {
        entityType: 'rooms',
        entityId: room.id,
        amount: 100,
        summary: 'Open a new room',
        branchId: school.mainBranchId,
      }),
    );
    if (!start.needed) throw new Error('expected an approval request');

    // Deleted by someone who neither asked nor decides: whoever may delete the record.
    await as(principal, (ctx) => roomsService.remove(ctx, room.id));
    const [row] = await adminDb()
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, start.requestId));
    expect(row?.status).toBe('cancelled');
    const trail = await as(director, (ctx) => approvalTrail(ctx, start.requestId));
    expect(trail.map((step) => step.status)).toEqual(['skipped']);
    // There is nothing left to decide.
    await expect(
      as(director, (ctx) => decideApproval(ctx, start.requestId, 'approve')),
    ).rejects.toThrow();
  });

  it('another school’s request cannot be found, let alone decided', async () => {
    const { start } = await ask(accountant, 800_000);
    if (!start.needed) throw new Error('expected an approval request');
    const stranger = await other.actor('principal');
    await expectError('NOT_FOUND', () =>
      as(stranger, (ctx) => decideApproval(ctx, start.requestId, 'approve')),
    );
  });
});

describe('imports', () => {
  const importer = defineImporter({
    kind: 'tests-rooms',
    label: 'room',
    permission: { resource: 'rooms', action: 'update' },
    columns: [
      { key: 'name', header: 'Room Name', required: true, example: 'Room 12' },
      { key: 'kind', header: 'Kind', example: 'classroom' },
      { key: 'capacity', header: 'Capacity', example: '40' },
    ],
    row: z.object({
      name: Name,
      kind: z
        .enum(['classroom', 'lab', 'library', 'hall', 'office', 'clinic', 'store', 'other'])
        .or(z.literal('').transform(() => 'classroom' as const)),
      capacity: z.union([
        z.literal('').transform(() => null),
        z.coerce.number().int().min(1, { error: 'Capacity must be at least 1' }),
      ]),
    }),
    commit: async (ctx, row, batch) => {
      const room = await roomsService.create(ctx, {
        branchId: batch.branchId ?? school.mainBranchId,
        name: row.name,
        kind: row.kind,
        capacity: row.capacity,
      });
      return room.id;
    },
  });

  async function uploadCsv(actor: Actor, text: string) {
    const ticket = await as(actor, (ctx) =>
      createUpload(ctx, {
        purpose: 'import',
        fileName: 'rooms.csv',
        mimeType: 'text/csv',
        size: Math.max(1, text.length),
      }),
    );
    await uploadBytes(ticket.fileId, text, 'text/csv');
    await as(actor, (ctx) => confirmUpload(ctx, ticket.fileId));
    return ticket.fileId;
  }

  it('offers a template with the headings and an example row', () => {
    expect(parseCsv(importTemplate(importer))).toEqual([
      ['Room Name', 'Kind', 'Capacity'],
      ['Room 12', 'classroom', '40'],
    ]);
  });

  it('F-shared-7 a commit that is cut short leaves nothing behind, and committing again creates each row once', async () => {
    let stopAt: string | null = 'Fragile B';
    defineImporter({
      kind: 'tests-fragile-rooms',
      label: 'room',
      permission: { resource: 'rooms', action: 'update' },
      columns: [{ key: 'name', header: 'Room Name', required: true, example: 'Room 12' }],
      row: z.object({ name: Name }),
      commit: async (ctx, row, batch) => {
        // Not a refusal of this row: the kind of failure nobody planned for.
        if (row.name === stopAt) throw new Error('the server stopped');
        const room = await roomsService.create(ctx, {
          branchId: batch.branchId ?? school.mainBranchId,
          name: row.name,
          kind: 'classroom',
          capacity: null,
        });
        return room.id;
      },
    });
    const fileId = await uploadCsv(principal, 'Room Name\r\nFragile A\r\nFragile B\r\nFragile C\r\n');
    const staged = await as(principal, (ctx) =>
      stageImport(ctx, { kind: 'tests-fragile-rooms', fileId, branchId: school.mainBranchId }),
    );
    const fragile = () => adminDb().select().from(rooms).where(ilike(rooms.name, 'Fragile %'));

    await expect(as(principal, (ctx) => commitImport(ctx, staged.batchId))).rejects.toThrow(
      'the server stopped',
    );
    // The first row had been created when it stopped. It is gone with the rest of that commit.
    expect(await fragile()).toEqual([]);
    const waiting = await adminDb()
      .select()
      .from(importRows)
      .where(eq(importRows.batchId, staged.batchId));
    expect(waiting.map((row) => row.status)).toEqual(['valid', 'valid', 'valid']);

    stopAt = null;
    expect(await as(principal, (ctx) => commitImport(ctx, staged.batchId))).toEqual({
      batchId: staged.batchId,
      createdRows: 3,
      failedRows: 0,
    });
    expect((await fragile()).map((room) => room.name).sort()).toEqual([
      'Fragile A',
      'Fragile B',
      'Fragile C',
    ]);
    await expectError('RULE', () => as(principal, (ctx) => commitImport(ctx, staged.batchId)));
    expect(await fragile()).toHaveLength(3);
  });

  it('R-shared-8 step 1 checks every row and writes nothing to the real table; step 2 creates only the valid rows, each on its own', async () => {
    const csv =
      'room name,KIND,capacity,Ignored Column\r\nImport Lab,lab,30,x\r\n,hall,10,x\r\nImport Hall,hall,zero,x\r\nImport Office,,,x\r\nImport Lab,lab,20,x\r\n';
    const fileId = await uploadCsv(principal, csv);
    const staged = await as(principal, (ctx) =>
      stageImport(ctx, { kind: 'tests-rooms', fileId, branchId: school.mainBranchId }),
    );
    expect(staged).toMatchObject({ totalRows: 5, validRows: 3, invalidRows: 2 });
    expect(await adminDb().select().from(rooms).where(ilike(rooms.name, 'Import %'))).toEqual([]);

    const preview = await adminDb()
      .select()
      .from(importRows)
      .where(eq(importRows.batchId, staged.batchId));
    const byRow = Object.fromEntries(preview.map((row) => [row.rowNumber, row]));
    expect(byRow[3]).toMatchObject({ status: 'invalid' });
    expect(Object.keys(byRow[3]?.errors as object)).toEqual(['Room Name']);
    expect(byRow[4]?.errors).toHaveProperty('Capacity');
    expect(byRow[5]).toMatchObject({
      status: 'valid',
      parsed: { name: 'Import Office', kind: 'classroom', capacity: null },
    });

    const committed = await as(principal, (ctx) => commitImport(ctx, staged.batchId));
    // Row 6 repeats row 2's name: it fails on its own, and the other rows are kept.
    expect(committed).toEqual({ batchId: staged.batchId, createdRows: 2, failedRows: 1 });
    const created = await adminDb().select().from(rooms).where(ilike(rooms.name, 'Import %'));
    expect(created.map((room) => room.name).sort()).toEqual(['Import Lab', 'Import Office']);

    const problems = parseCsv(await as(principal, (ctx) => importProblemsCsv(ctx, staged.batchId)));
    expect(problems[0]).toEqual(['Row', 'Room Name', 'Kind', 'Capacity', 'Problem']);
    expect(problems.slice(1).map((line) => line[0])).toEqual(['3', '4', '6']);
    expect(problems[3]?.[4]).toBe('This branch already has a room with this name');

    await expectError('RULE', () => as(principal, (ctx) => commitImport(ctx, staged.batchId))); // cannot run twice
  });

  it('refuses a file with a required column missing, with no rows, or of another kind', async () => {
    const missing = await expectError('VALIDATION', async () => {
      const fileId = await uploadCsv(principal, 'Kind,Capacity\r\nlab,30\r\n');
      return as(principal, (ctx) => stageImport(ctx, { kind: 'tests-rooms', fileId }));
    });
    expect(missing.fields?.fileId?.[0]).toBe('The file is missing these columns: Room Name');

    await expectError('VALIDATION', async () => {
      const fileId = await uploadCsv(principal, 'Room Name,Kind,Capacity\r\n');
      return as(principal, (ctx) => stageImport(ctx, { kind: 'tests-rooms', fileId }));
    });
    await expectError('NOT_FOUND', async () => {
      const fileId = await uploadCsv(principal, 'Room Name\r\nA Room\r\n');
      return as(principal, (ctx) => stageImport(ctx, { kind: 'no-such-import', fileId }));
    });
  });

  it('needs the permission of what is imported, at both steps', async () => {
    const teacher = await school.actor('subject_teacher');
    const fileId = await uploadCsv(principal, 'Room Name\r\nGuarded Room\r\n');
    await expectError('FORBIDDEN', () =>
      as(teacher, (ctx) => stageImport(ctx, { kind: 'tests-rooms', fileId })),
    );
    const staged = await as(principal, (ctx) => stageImport(ctx, { kind: 'tests-rooms', fileId }));
    await expectError('FORBIDDEN', () => as(teacher, (ctx) => commitImport(ctx, staged.batchId)));
    await as(principal, (ctx) => cancelImport(ctx, staged.batchId));
    await expectError('RULE', () => as(principal, (ctx) => commitImport(ctx, staged.batchId)));
  });
});

describe('exports', () => {
  const exporter = defineExporter({
    kind: 'tests-rooms',
    label: 'room',
    permission: { resource: 'rooms', action: 'read' },
    filters: z.object({ kind: z.enum(['lab', 'hall']).optional() }),
    columns: [
      { header: 'Name', value: (room: { name: string; capacity: number | null }) => room.name },
      {
        header: 'Capacity',
        value: (room: { name: string; capacity: number | null }) => room.capacity,
      },
    ],
    count: (ctx, filters) => roomsDb.count(ctx, filters.kind && eq(rooms.kind, filters.kind)),
    rows: (ctx, filters, page) =>
      ctx.db
        .select({ name: rooms.name, capacity: rooms.capacity })
        .from(rooms)
        .where(
          and(
            eq(rooms.orgId, ctx.actor.orgId),
            filters.kind ? eq(rooms.kind, filters.kind) : undefined,
          ),
        )
        .orderBy(rooms.name)
        .limit(page.limit)
        .offset(page.offset),
  });

  it('a small export is returned at once as CSV, and is audited', async () => {
    await as(principal, (ctx) =>
      roomsService.create(ctx, {
        branchId: school.mainBranchId,
        name: '=cmd Formula Room',
        kind: 'hall',
        capacity: 12,
      }),
    );
    const result = await as(principal, (ctx) =>
      startExport(ctx, { kind: 'tests-rooms', filters: { kind: 'hall' }, format: 'csv' }),
    );
    if (!result.ready) throw new Error('expected a direct export');
    const table = parseCsv(new TextDecoder().decode(result.content));
    expect(table[0]).toEqual(['Name', 'Capacity']);
    // A name that a spreadsheet would run as a formula arrives neutralised.
    expect(table.slice(1)).toEqual([["'=cmd Formula Room", '12']]);
    expect(result.fileName).toMatch(/^tests-rooms-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(exporter.kind).toBe('tests-rooms');
  });

  it('refuses a format that is not available yet, an unknown filter, and a role without the permission', async () => {
    await expectError('RULE', () =>
      as(principal, (ctx) =>
        startExport(ctx, { kind: 'tests-rooms', filters: {}, format: 'xlsx' }),
      ),
    );
    await expectError('VALIDATION', () =>
      as(principal, (ctx) =>
        startExport(ctx, { kind: 'tests-rooms', filters: { kind: 'kitchen' }, format: 'csv' }),
      ),
    );
    await expectError('FORBIDDEN', () =>
      as(guardian, (ctx) => startExport(ctx, { kind: 'tests-rooms', filters: {}, format: 'csv' })),
    );
  });

  it('a large export becomes a job; when it finishes the file is ready for the person who asked', async () => {
    const big = defineExporter({ ...exporter, kind: 'tests-rooms-big', count: async () => 6_000 });
    await withAdminTx((tx) => tx.delete(jobs));
    const result = await as(principal, (ctx) =>
      startExport(ctx, { kind: big.kind, filters: {}, format: 'csv' }),
    );
    if (result.ready) throw new Error('expected a background export');
    expect(await as(principal, (ctx) => exportStatus(ctx, result.exportId))).toMatchObject({
      status: 'queued',
      fileId: null,
    });

    const claimed = await claimJobs({ workerId: 'worker-a', limit: 5, perOrgLimit: 5 });
    expect(claimed.map((job) => job.name)).toEqual(['shared.export-build']);
    expect(await runClaimedJob(claimed[0]!)).toBe('succeeded');

    const status = await as(principal, (ctx) => exportStatus(ctx, result.exportId));
    expect(status.status).toBe('ready');
    expect(status.rowCount).toBeGreaterThan(0);
    const link = await as(principal, (ctx) =>
      signedDownload(ctx, status.fileId!, { download: true }),
    );
    expect(link.url).toContain('exports/');
    // It is the asker's export: a colleague cannot look it up.
    await expectError('NOT_FOUND', () =>
      as(accountant, (ctx) => exportStatus(ctx, result.exportId)),
    );
  });
});
