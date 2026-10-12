import { z } from 'zod';
import { ShortText } from '../../kernel/primitives';
import { FilePurpose, FileStatus } from './shared.constants';

/*
 * Files attached to a record of any kind: docs/plan/10-modules/m00-shared-kernel.md, section 4.
 * A record is named by its kind (a resource name such as `students`) and its id.
 */

/** A resource name: lower case, words joined by hyphens. */
export const EntityType = z
  .string()
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'Not the name of a kind of record')
  .max(60);

export const ListAttachments = z.strictObject({ entityType: EntityType, entityId: z.uuid() });
export type ListAttachments = z.output<typeof ListAttachments>;

export const CreateAttachment = z.object({
  entityType: EntityType,
  entityId: z.uuid(),
  /** A file that has finished uploading. */
  fileId: z.uuid(),
  label: ShortText.optional(),
});
export type CreateAttachment = z.output<typeof CreateAttachment>;

export const Attachment = z.object({
  id: z.uuid(),
  entityType: z.string(),
  entityId: z.uuid(),
  fileId: z.uuid(),
  label: z.string().nullable(),
  sortOrder: z.int(),
  createdAt: z.string(),
  /** What the list shows about the file itself. The link to open it comes from `GET /files/[id]/url`. */
  file: z.object({
    name: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number(),
    purpose: FilePurpose,
    status: FileStatus,
  }),
});
export type Attachment = z.output<typeof Attachment>;

/** A link a file can be read from for a few minutes. */
export const FileLink = z.object({ url: z.string(), expiresAt: z.string() });
export type FileLink = z.output<typeof FileLink>;
