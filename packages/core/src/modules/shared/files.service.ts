import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type {
  Attachment,
  CreateAttachment,
  CreateUpload,
  FileLink,
  FilePurpose,
  ListAttachments,
  UploadTicket,
} from '@takhti/contracts';
import { attachments, files } from '@takhti/db';
import { stampOf, type Ctx } from '../../kernel/context';
import { forbidden, notFound, rule } from '../../kernel/errors';
import { attach, confirmUpload, createUpload, detach, signedDownload } from '../../kernel/files';
import { canReadRecord, canUpdateRecord } from '../../kernel/record-access';

/*
 * Files and attachments over HTTP: docs/plan/10-modules/m00-shared-kernel.md, rules R-shared-1 to 3.
 * The kernel (`kernel/files.ts`) does the work; this service decides who may ask for it.
 */

/** Made by the server alone: an export, a generated PDF. Nobody uploads one. */
const serverMade: readonly FilePurpose[] = ['export', 'generated'];
/** What a guardian or a student may upload. */
const familyMay: readonly FilePurpose[] = ['photo', 'document', 'learning', 'payment_proof'];

async function readableFile(ctx: Ctx, fileId: string) {
  // Row-level security already limits this: staff see the school's files, anyone else their own uploads.
  const [file] = await ctx.db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
    .limit(1);
  if (!file) throw notFound('File');
  return file;
}

async function linksOf(ctx: Ctx, fileId: string) {
  return ctx.db
    .select({ entityType: attachments.entityType, entityId: attachments.entityId })
    .from(attachments)
    .where(and(eq(attachments.fileId, fileId), isNull(attachments.deletedAt)));
}

export const filesService = {
  /** Step 1 of an upload: a link to send the bytes to. */
  async createUpload(ctx: Ctx, input: CreateUpload): Promise<UploadTicket> {
    const family = ctx.actor.kind === 'guardian' || ctx.actor.kind === 'student';
    if (serverMade.includes(input.purpose) || (family && !familyMay.includes(input.purpose)))
      throw forbidden('You cannot upload this kind of file');
    return createUpload(ctx, input);
  },

  /** Step 3: checks what arrived against what was promised and marks the file ready (R-shared-1). */
  confirm: (ctx: Ctx, fileId: string) => confirmUpload(ctx, fileId),

  /**
   * R-shared-3: a link for the person who uploaded the file, or for anyone who can read a record
   * it is attached to. To anyone else the file does not exist.
   */
  async downloadUrl(ctx: Ctx, fileId: string): Promise<FileLink> {
    const file = await readableFile(ctx, fileId);
    if (file.uploadedBy !== ctx.actor.userId) {
      let allowed = false;
      for (const link of await linksOf(ctx, file.id)) {
        if (await canReadRecord(ctx, link.entityType, link.entityId)) {
          allowed = true;
          break;
        }
      }
      if (!allowed) throw notFound('File');
    }
    return signedDownload(ctx, file.id, { download: true });
  },

  /** Withdraws one's own upload, while nothing uses it. */
  async remove(ctx: Ctx, fileId: string): Promise<void> {
    const file = await readableFile(ctx, fileId);
    if (file.uploadedBy !== ctx.actor.userId) throw notFound('File');
    if ((await linksOf(ctx, file.id)).length > 0)
      throw rule('This file is attached to a record. Remove it from the record first.');
    const [gone] = await ctx.db
      .update(files)
      .set({
        status: 'deleted',
        deletedAt: ctx.now,
        updatedAt: ctx.now,
        updatedBy: stampOf(ctx),
        version: sql`${files.version} + 1`,
      })
      .where(and(eq(files.id, file.id), isNull(files.deletedAt)))
      .returning({ id: files.id });
    // A family may change its own file only until it is confirmed; after that it has been handed in.
    if (!gone) throw rule('This file has been handed in and can no longer be withdrawn');
  },
};

export const attachmentsService = {
  /** The files attached to a record the person can read. */
  async list(ctx: Ctx, query: ListAttachments): Promise<Attachment[]> {
    if (!(await canReadRecord(ctx, query.entityType, query.entityId))) throw notFound('Record');
    const rows = await ctx.db
      .select({
        id: attachments.id,
        entityType: attachments.entityType,
        entityId: attachments.entityId,
        fileId: attachments.fileId,
        label: attachments.label,
        sortOrder: attachments.sortOrder,
        createdAt: attachments.createdAt,
        name: files.originalName,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        purpose: files.purpose,
        status: files.status,
      })
      .from(attachments)
      .innerJoin(files, eq(files.id, attachments.fileId))
      .where(
        and(
          eq(attachments.entityType, query.entityType),
          eq(attachments.entityId, query.entityId),
          isNull(attachments.deletedAt),
        ),
      )
      .orderBy(asc(attachments.sortOrder), asc(attachments.createdAt));
    return rows.map(({ name, mimeType, sizeBytes, purpose, status, ...link }) => ({
      ...link,
      file: { name, mimeType, sizeBytes, purpose, status },
    }));
  },

  /** R-shared-2: only someone who can change the record may attach a file to it. */
  async attach(ctx: Ctx, input: CreateAttachment): Promise<Attachment> {
    if (!(await canReadRecord(ctx, input.entityType, input.entityId))) throw notFound('Record');
    if (!(await canUpdateRecord(ctx, input.entityType, input.entityId)))
      throw forbidden('You can see this record but not attach files to it');
    const id = await attach(ctx, input.entityType, input.entityId, input.fileId, input.label);
    const all = await attachmentsService.list(ctx, input);
    const made = all.find((item) => item.id === id);
    if (!made) throw new Error('The attachment could not be read back');
    return made;
  },

  async detach(ctx: Ctx, attachmentId: string): Promise<void> {
    const [link] = await ctx.db
      .select({ entityType: attachments.entityType, entityId: attachments.entityId })
      .from(attachments)
      .where(and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt)))
      .limit(1);
    if (!link || !(await canReadRecord(ctx, link.entityType, link.entityId)))
      throw notFound('Attachment');
    if (!(await canUpdateRecord(ctx, link.entityType, link.entityId)))
      throw forbidden('You can see this record but not change its files');
    await detach(ctx, attachmentId);
  },
};
