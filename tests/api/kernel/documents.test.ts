import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  hashToken,
  memoryStorage,
  placeholderPdf,
  requestDocument,
  runAsSystem,
  setDocumentRenderer,
  setStorageProvider,
  sha256,
  type Actor,
} from '@takhti/core';
import { adminDb, files, generatedDocuments } from '@takhti/db';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, expectError, seedOrg, type TestOrg } from '../../helpers/world';

/*
 * `requestDocument`: the one way a PDF is made and recorded.
 * docs/plan/00-foundation/13-notifications-jobs-and-files.md, section 4.
 */

let db: TestDb;
let school: TestOrg;
let cashier: Actor;
let guardian: Actor;
const store = memoryStorage();
const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

beforeAll(async () => {
  db = await createTestDb();
  setStorageProvider(store);
  school = await seedOrg();
  cashier = await school.actor('cashier');
  guardian = await school.actor('guardian');
});
afterAll(async () => {
  setStorageProvider(undefined);
  setDocumentRenderer(undefined);
  await db.destroy();
});

const receipt = (number: string, entityId: string = randomUUID()) => ({
  kind: 'fee-receipt',
  entityType: 'fee-payments',
  entityId,
  number,
  title: 'Fee receipt',
  lines: ['Received Rs 8,500 from Farhan Ahmed', 'For Ayesha Ahmed, Grade 1'],
});

describe('the stand-in page', () => {
  const page = {
    kind: 'fee-receipt',
    title: 'Fee receipt (copy)',
    number: 'R-2610-00042',
    issuedOn: '12 October 2026',
    language: 'en' as const,
    lines: ['Received Rs 8,500', 'A back\\slash and (brackets)'],
  };

  it('is a one-page PDF a reader can open: a header, a cross-reference table that points at each object, an end mark', () => {
    const pdf = text(placeholderPdf(page));
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf).toContain('/Count 1');
    // Every offset in the table is where its object really starts.
    const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset, index) => {
      expect(pdf.slice(offset, offset + 8)).toBe(`${index + 1} 0 obj\n`);
    });
    const start = Number(/startxref\n(\d+)\n/.exec(pdf)?.[1]);
    expect(pdf.slice(start, start + 4)).toBe('xref');
    // The stream is as long as it says.
    const length = Number(/\/Length (\d+)/.exec(pdf)?.[1]);
    const stream = /stream\n([\s\S]*)\nendstream/.exec(pdf)?.[1] ?? '';
    expect(stream.length).toBe(length);
  });

  it('says what the document is, and escapes what a PDF string must', () => {
    const pdf = text(placeholderPdf(page));
    expect(pdf).toContain('(Fee receipt \\(copy\\)) Tj');
    expect(pdf).toContain('(No. R-2610-00042) Tj');
    expect(pdf).toContain('(Issued 12 October 2026) Tj');
    expect(pdf).toContain('(A back\\\\slash and \\(brackets\\)) Tj');
    expect(pdf).toContain('Document kind: fee-receipt.');
  });

  it('text the built-in font cannot show is replaced, never written as broken bytes', () => {
    const pdf = text(placeholderPdf({ ...page, title: 'فیس receipt', number: undefined }));
    expect(pdf).toContain('(??? receipt) Tj');
    expect(pdf).not.toContain('No. ');
  });
});

describe('requestDocument', () => {
  it('stores the file as ready in the generated bucket and records the document with the hash of its content', async () => {
    const paymentId = randomUUID();
    const made = await as(cashier, (ctx) => requestDocument(ctx, receipt('R-2610-00042', paymentId)));
    expect(made).toMatchObject({ number: 'R-2610-00042' });
    expect(made.verifyToken).toBeUndefined();

    const [file] = await adminDb().select().from(files).where(eq(files.id, made.fileId));
    expect(file).toMatchObject({
      orgId: school.orgId,
      bucket: 'generated',
      purpose: 'generated',
      mimeType: 'application/pdf',
      status: 'ready',
      originalName: 'fee-receipt-R-2610-00042.pdf',
      uploadedBy: cashier.userId,
    });
    expect(file!.path.startsWith(`${school.orgId}/generated/`)).toBe(true);
    const stored = await store.get('generated', file!.path);
    expect(stored).not.toBeNull();
    expect(stored!.byteLength).toBe(file!.sizeBytes);
    expect(text(stored!)).toContain('(Received Rs 8,500 from Farhan Ahmed) Tj');

    const [document] = await adminDb()
      .select()
      .from(generatedDocuments)
      .where(eq(generatedDocuments.id, made.id));
    expect(document).toMatchObject({
      orgId: school.orgId,
      kind: 'fee-receipt',
      entityType: 'fee-payments',
      entityId: paymentId,
      fileId: made.fileId,
      number: 'R-2610-00042',
      language: 'en',
      contentHash: sha256(stored!),
      verifyTokenHash: null,
      createdBy: cashier.userId,
    });
  });

  it('a document that can be verified returns its code once and keeps only the hash', async () => {
    const made = await as(cashier, (ctx) =>
      requestDocument(ctx, { ...receipt('R-2610-00043'), verify: true, language: 'both' }),
    );
    expect(made.verifyToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const [document] = await adminDb()
      .select()
      .from(generatedDocuments)
      .where(eq(generatedDocuments.id, made.id));
    expect(document).toMatchObject({
      language: 'both',
      verifyTokenHash: hashToken(made.verifyToken!),
    });
    expect(JSON.stringify(document)).not.toContain(made.verifyToken!);
  });

  it('a number is never used twice for one kind, and the refusal names the field', async () => {
    await as(cashier, (ctx) => requestDocument(ctx, receipt('R-2610-00050')));
    const error = await expectError('CONFLICT', () =>
      as(cashier, (ctx) => requestDocument(ctx, receipt('R-2610-00050'))),
    );
    expect(error.fields).toEqual({ number: ['A document of this kind already carries this number'] });
    // The same number on another kind of document is a different document.
    await as(cashier, (ctx) =>
      requestDocument(ctx, { ...receipt('R-2610-00050'), kind: 'fee-refund-voucher' }),
    );
  });

  it('a background job makes a document for the person it is working for', async () => {
    const made = await runAsSystem(school.orgId, {}, (ctx) =>
      requestDocument(ctx, { ...receipt('R-2610-00060'), requestedBy: cashier.userId }),
    );
    const [file] = await adminDb().select().from(files).where(eq(files.id, made.fileId));
    expect(file?.uploadedBy).toBe(cashier.userId);
    const [document] = await adminDb()
      .select()
      .from(generatedDocuments)
      .where(eq(generatedDocuments.id, made.id));
    expect(document?.createdBy).toBeNull();
  });

  it('when the renderer fails nothing is recorded: no file row, no document', async () => {
    const before = await adminDb().select().from(generatedDocuments);
    setDocumentRenderer({
      name: 'broken',
      render: async () => {
        throw new Error('The renderer is down');
      },
    });
    await expect(
      as(cashier, (ctx) => requestDocument(ctx, receipt('R-2610-00070'))),
    ).rejects.toThrow('The renderer is down');
    setDocumentRenderer(undefined);
    expect(await adminDb().select().from(generatedDocuments)).toHaveLength(before.length);
  });

  it('a kind that is not a key of the catalogue is a programming error', async () => {
    await expect(
      as(cashier, (ctx) => requestDocument(ctx, { ...receipt('R-1'), kind: 'Fee Receipt' })),
    ).rejects.toThrow(/document catalogue/);
  });

  it('a family cannot write the register of documents', async () => {
    await expectError('FORBIDDEN', () =>
      as(guardian, (ctx) => requestDocument(ctx, receipt('R-2610-00080'))),
    );
  });
});
