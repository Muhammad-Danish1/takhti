import type { DocumentLanguage } from '@takhti/contracts';
import { generatedDocuments } from '@takhti/db';
import { stampOf, type Ctx } from './context';
import { hashToken, randomToken, sha256 } from './crypto';
import { formatDay } from './dates';
import { registerConstraintMessages } from './errors';
import { storeGeneratedFile } from './files';
import { newId } from './ids';

/*
 * Documents: every PDF the product makes goes through `requestDocument`.
 * docs/plan/00-foundation/13-notifications-jobs-and-files.md, section 4, and the document catalogue.
 *
 *   const { id, fileId } = await requestDocument(ctx, {
 *     kind: 'fee-receipt', entityType: 'fee-payments', entityId: payment.id,
 *     number: payment.receiptNo, verify: true,
 *     title: 'Fee receipt', lines: [`Received ${formatRs(payment.amount)}`],
 *   });
 *
 * It makes the file, stores it in the `generated` bucket, and records it in `generated_documents`
 * with a hash of its content, in the caller's transaction. Whether the person may have the document
 * is the calling service's decision, made before it calls. The caller is a member of staff or a
 * background job: a family never writes the register of documents.
 *
 * Until Phase 16 draws the real pages, the renderer is a stand-in that writes one plain page saying
 * what the document is. Everything around it (the record, the number, the verification code, the
 * stored file) is already the real thing, so a module's service does not change when the pages arrive.
 */

export interface DocumentRequest {
  /** A key from the document catalogue: `fee-receipt`, `certificate-leaving`. */
  kind: string;
  /** The record the document is about. */
  entityType: string;
  entityId: string;
  /** Default `en`. */
  language?: DocumentLanguage;
  /** The number printed on it, when it has one. Never used twice for one kind. */
  number?: string;
  /** It carries a code that opens the public page confirming it is genuine. */
  verify?: boolean;
  /** For a document made as one of many. */
  batchId?: string;
  /**
   * The person the document is for, when a background job asks for it. A job is nobody, and the
   * stored file needs an owner; a request made by a person is owned by that person.
   */
  requestedBy?: string;
  /** What the page is headed. */
  title: string;
  /** What the stand-in page says under its heading. The real page takes its data from the record. */
  lines?: readonly string[];
}

export interface RequestedDocument {
  /** The id of the `generated_documents` row. */
  id: string;
  fileId: string;
  number: string | null;
  /**
   * The code for the verification link, returned once: only its hash is kept.
   * Present when the document was asked for with `verify`.
   */
  verifyToken?: string;
}

export interface DocumentPage {
  kind: string;
  title: string;
  number: string | undefined;
  /** The day it was issued, as a person reads it. */
  issuedOn: string;
  language: DocumentLanguage;
  lines: readonly string[];
}

/** Turns what a document says into the bytes of a PDF. */
export interface DocumentRenderer {
  name: string;
  render(page: DocumentPage): Promise<Uint8Array>;
}

registerConstraintMessages({
  generated_documents_number_uq: {
    message: 'A document of this kind already carries this number',
    field: 'number',
  },
});

// ---------------------------------------------------------------------------------------------
// The stand-in page
// ---------------------------------------------------------------------------------------------

/** Text as the built-in PDF fonts can show it: plain Latin, with the three characters a PDF string escapes. */
function pdfText(text: string): string {
  return text
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * A one-page A4 PDF holding a heading and a few lines of text, written by hand so that it needs no
 * library and no browser. It uses the built-in Helvetica, so only plain Latin text is shown; Urdu
 * arrives with the real pages and their embedded fonts.
 */
export function placeholderPdf(page: DocumentPage): Uint8Array {
  const heading = [page.title, ...(page.number ? [`No. ${page.number}`] : [])];
  const body = [
    `Issued ${page.issuedOn}`,
    ...page.lines.slice(0, 40),
    '',
    `Document kind: ${page.kind}. This page is a stand-in until the printed layout is built.`,
  ];
  const commands = [
    'BT',
    '/F1 18 Tf',
    '72 770 Td',
    ...heading.flatMap((line, index) => [
      ...(index > 0 ? ['0 -24 Td'] : []),
      `(${pdfText(line)}) Tj`,
    ]),
    '/F1 11 Tf',
    '0 -32 Td',
    ...body.flatMap((line, index) => [
      ...(index > 0 ? ['0 -16 Td'] : []),
      `(${pdfText(line.slice(0, 95))}) Tj`,
    ]),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(commands, 'latin1')} >>\nstream\n${commands}\nendstream`,
  ];
  let text = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(text, 'latin1'));
    text += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = Buffer.byteLength(text, 'latin1');
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) text += `${String(offset).padStart(10, '0')} 00000 n \n`;
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(text, 'latin1'));
}

const standIn: DocumentRenderer = {
  name: 'placeholder',
  render: async (page) => placeholderPdf(page),
};

let renderer: DocumentRenderer = standIn;

export const documentRenderer = (): DocumentRenderer => renderer;

/** Replaces the renderer: the real one in Phase 16, a failing one in a test. */
export function setDocumentRenderer(next: DocumentRenderer | undefined): void {
  renderer = next ?? standIn;
}

// ---------------------------------------------------------------------------------------------
// requestDocument
// ---------------------------------------------------------------------------------------------

export async function requestDocument(
  ctx: Ctx,
  request: DocumentRequest,
): Promise<RequestedDocument> {
  if (!/^[a-z][a-z0-9-]*$/.test(request.kind))
    throw new Error(`Document kind "${request.kind}" must be a key of the document catalogue`);
  const language = request.language ?? 'en';
  const content = await renderer.render({
    kind: request.kind,
    title: request.title,
    number: request.number,
    issuedOn: formatDay(ctx.today),
    language,
    lines: request.lines ?? [],
  });
  const fileId = await storeGeneratedFile(ctx, {
    purpose: 'generated',
    fileName: `${request.kind}${request.number ? `-${request.number}` : ''}.pdf`,
    mimeType: 'application/pdf',
    content,
    ...(request.requestedBy && { ownerUserId: request.requestedBy }),
  });

  const id = newId();
  const verifyToken = request.verify ? randomToken() : undefined;
  const stamp = stampOf(ctx);
  // Only staff and background jobs write the register of documents. A family's own receipt is made
  // when the payment is recorded, or by a job; the family then reaches the file through a signed link.
  await ctx.db.insert(generatedDocuments).values({
    id,
    orgId: ctx.actor.orgId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: stamp,
    updatedBy: stamp,
    kind: request.kind,
    entityType: request.entityType,
    entityId: request.entityId,
    fileId,
    number: request.number ?? null,
    language,
    contentHash: sha256(content),
    verifyTokenHash: verifyToken ? hashToken(verifyToken) : null,
    batchId: request.batchId ?? null,
  });
  return {
    id,
    fileId,
    number: request.number ?? null,
    ...(verifyToken && { verifyToken }),
  };
}
