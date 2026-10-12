import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  fileExtensions,
  filePurposeRules,
  type ConfirmedUpload,
  type FilePurpose,
  type FilePurposeRule,
  type UploadTicket,
} from '@takhti/contracts';
import { attachments, files } from '@takhti/db';
import { storage } from '../providers/storage';
import { audit } from './audit';
import { stampOf, type Ctx } from './context';
import { addSeconds } from './dates';
import { invalid, notFound, rule } from './errors';
import { newId } from './ids';

/*
 * Files. The bytes live in Storage; a row in `files` is the record of them.
 *
 *   1. createUpload   checks the purpose's limits, records a `pending` file, returns a signed upload link
 *   2. the client sends the bytes straight to Storage with that link
 *   3. confirmUpload  compares what arrived with what was promised and marks the file `ready`
 *   4. the file id goes into the body of whatever record it belongs to
 *   5. signedDownload gives a link that works for five minutes
 *
 * Clients never use their own storage rights. Whether someone may see a file is decided by the
 * service of the record the file belongs to, in one place, before a link is issued.
 */

const MB = 1024 * 1024;
const extensions = fileExtensions;
type PurposeRule = FilePurposeRule;

const formatSize = (bytes: number) =>
  bytes >= MB ? `${Math.round((bytes / MB) * 10) / 10} MB` : `${Math.ceil(bytes / 1024)} KB`;

/** A display name is kept for people to read; it is never part of a path. */
const cleanName = (name: string) =>
  name
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'file';

export interface UploadRequest {
  purpose: FilePurpose;
  fileName: string;
  mimeType: string;
  size: number;
}

/** Throws `VALIDATION` with the field at fault when a file breaks its purpose's limits. */
export function checkFileLimits(request: UploadRequest): PurposeRule {
  const purposeRule = filePurposeRules[request.purpose];
  if (!purposeRule.types.includes(request.mimeType)) {
    throw invalid({ mimeType: [`${purposeRule.label}: this kind of file is not accepted`] });
  }
  if (!Number.isInteger(request.size) || request.size <= 0)
    throw invalid({ size: ['The file is empty'] });
  if (request.size > purposeRule.maxBytes) {
    throw invalid({
      size: [
        `${purposeRule.label}: the file is ${formatSize(request.size)}; the limit is ${formatSize(purposeRule.maxBytes)}`,
      ],
    });
  }
  return purposeRule;
}

/** Step 1: records a pending file and returns the link to upload it with. */
export async function createUpload(ctx: Ctx, request: UploadRequest): Promise<UploadTicket> {
  const purposeRule = checkFileLimits(request);
  const id = newId();
  const path = `${ctx.actor.orgId}/${request.purpose}/${ctx.today.slice(0, 4)}/${id}.${extensions[request.mimeType] ?? 'bin'}`;
  await ctx.db.insert(files).values({
    id,
    orgId: ctx.actor.orgId,
    bucket: purposeRule.bucket,
    path,
    purpose: request.purpose,
    originalName: cleanName(request.fileName),
    mimeType: request.mimeType,
    sizeBytes: request.size,
    status: 'pending',
    uploadedBy: ctx.actor.userId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: stampOf(ctx),
    updatedBy: stampOf(ctx),
  });
  const link = await storage().createUploadUrl(purposeRule.bucket, path);
  return { fileId: id, uploadUrl: link.url, expiresAt: addSeconds(ctx.now, link.expiresInSeconds) };
}

async function ownPending(ctx: Ctx, fileId: string) {
  const [file] = await ctx.db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
    .limit(1);
  if (!file) throw notFound('File');
  return file;
}

/**
 * Step 3: checks that what reached Storage is what was promised, then marks the file ready.
 * A file that is empty, too large or of another type is removed from Storage and quarantined.
 *
 * A quarantine is a fact that must be kept, so it is an answer and not an error: an error would
 * undo the very mark that records it. The caller reads `status`.
 */
export async function confirmUpload(ctx: Ctx, fileId: string): Promise<ConfirmedUpload> {
  const file = await ownPending(ctx, fileId);
  if (file.status === 'ready') return { id: file.id, status: 'ready' };
  if (file.status !== 'pending') throw rule('This file can no longer be used');
  if (ctx.actor.kind !== 'system' && file.uploadedBy !== ctx.actor.userId) throw notFound('File');

  const stored = await storage().stat(file.bucket, file.path);
  if (!stored) throw rule('The file has not finished uploading yet. Try again in a moment.');

  const purposeRule = filePurposeRules[file.purpose];
  const wrongType =
    stored.mimeType !== null &&
    stored.mimeType !== file.mimeType &&
    !purposeRule.types.includes(stored.mimeType);
  if (stored.size > purposeRule.maxBytes || stored.size === 0 || wrongType) {
    await storage().remove(file.bucket, [file.path]);
    await ctx.db
      .update(files)
      .set({
        status: 'quarantined',
        updatedAt: ctx.now,
        updatedBy: stampOf(ctx),
        version: sql`${files.version} + 1`,
      })
      .where(eq(files.id, file.id));
    return {
      id: file.id,
      status: 'quarantined',
      reason:
        stored.size === 0
          ? 'The file is empty'
          : wrongType
            ? 'This file type is not allowed'
            : 'The file is larger than allowed',
    };
  }

  await ctx.db
    .update(files)
    .set({
      status: 'ready',
      sizeBytes: stored.size,
      updatedAt: ctx.now,
      updatedBy: stampOf(ctx),
      version: sql`${files.version} + 1`,
    })
    .where(eq(files.id, file.id));
  return { id: file.id, status: 'ready' };
}

/**
 * Step 5: a link that works for five minutes. The caller has already decided that this user may
 * see the record the file belongs to; this only refuses files that are not ready.
 */
export async function signedDownload(
  ctx: Ctx,
  fileId: string,
  options: { expiresInSeconds?: number; download?: boolean } = {},
): Promise<{ url: string; expiresAt: string }> {
  const file = await ownPending(ctx, fileId);
  if (file.status !== 'ready') throw rule('This file is not available');
  const seconds = options.expiresInSeconds ?? 300;
  const url = await storage().createDownloadUrl(
    file.bucket,
    file.path,
    seconds,
    options.download ? file.originalName : undefined,
  );
  return { url, expiresAt: addSeconds(ctx.now, seconds) };
}

/** Stores a file the server made itself (an export, a generated PDF) and records it as ready. */
export async function storeGeneratedFile(
  ctx: Ctx,
  input: {
    purpose: FilePurpose;
    fileName: string;
    mimeType: string;
    content: Uint8Array;
    /** The person the file is for, when a background job makes it: a job is nobody, and a file needs an owner. */
    ownerUserId?: string;
  },
): Promise<string> {
  const purposeRule = checkFileLimits({
    purpose: input.purpose,
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.content.byteLength,
  });
  const id = newId();
  const path = `${ctx.actor.orgId}/${input.purpose}/${ctx.today.slice(0, 4)}/${id}.${extensions[input.mimeType] ?? 'bin'}`;
  await storage().put(purposeRule.bucket, path, input.content, input.mimeType);
  await ctx.db.insert(files).values({
    id,
    orgId: ctx.actor.orgId,
    bucket: purposeRule.bucket,
    path,
    purpose: input.purpose,
    originalName: cleanName(input.fileName),
    mimeType: input.mimeType,
    sizeBytes: input.content.byteLength,
    status: 'ready',
    // A file needs a real owner: whoever is acting, or the person a job is working for.
    uploadedBy: input.ownerUserId ?? ctx.actor.userId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: stampOf(ctx),
    updatedBy: stampOf(ctx),
  });
  return id;
}

/** Makes sure a file id sent by a client is a ready file of this organisation, before it is saved on a record. */
export async function assertReadyFile(
  ctx: Ctx,
  fileId: string,
  purposes?: readonly FilePurpose[],
): Promise<void> {
  const file = await ownPending(ctx, fileId);
  if (file.status !== 'ready') throw invalid({ fileId: ['The file has not finished uploading'] });
  if (purposes && !purposes.includes(file.purpose))
    throw invalid({ fileId: ['This file cannot be used here'] });
}

/** Links a ready file to any record. */
export async function attach(
  ctx: Ctx,
  entityType: string,
  entityId: string,
  fileId: string,
  label?: string,
): Promise<string> {
  await assertReadyFile(ctx, fileId);
  const id = newId();
  const [position] = await ctx.db
    .select({ next: sql<number>`coalesce(max(${attachments.sortOrder}), -1) + 1` })
    .from(attachments)
    .where(
      and(
        eq(attachments.entityType, entityType),
        eq(attachments.entityId, entityId),
        isNull(attachments.deletedAt),
      ),
    );
  await ctx.db.insert(attachments).values({
    id,
    orgId: ctx.actor.orgId,
    entityType,
    entityId,
    fileId,
    label: label?.trim().slice(0, 200) || null,
    sortOrder: Number(position?.next ?? 0),
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: stampOf(ctx),
    updatedBy: stampOf(ctx),
  });
  await audit(ctx, entityType, 'attach', entityId, {
    summary: label ? `Attached "${label}"` : 'Attached a file',
  });
  return id;
}

/** Removes the link. The file itself stays until the cleanup job finds it unused. */
export async function detach(ctx: Ctx, attachmentId: string): Promise<void> {
  const [row] = await ctx.db
    .update(attachments)
    .set({
      deletedAt: ctx.now,
      updatedAt: ctx.now,
      updatedBy: stampOf(ctx),
      version: sql`${attachments.version} + 1`,
    })
    .where(and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt)))
    .returning({ entityType: attachments.entityType, entityId: attachments.entityId });
  if (!row) throw notFound('Attachment');
  await audit(ctx, row.entityType, 'detach', row.entityId, { summary: 'Removed an attached file' });
}
