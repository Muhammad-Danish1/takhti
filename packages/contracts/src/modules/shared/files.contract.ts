import { z } from 'zod';
import { FilePurpose, type filePurposes } from './shared.constants';

/*
 * What may be uploaded, for which purpose, and where it is kept.
 * The limits are in the contracts so that a screen can refuse a file before the upload starts,
 * with exactly the rule the server will apply.
 * Source: docs/plan/00-foundation/13-notifications-jobs-and-files.md.
 */

const MB = 1024 * 1024;

export interface FilePurposeRule {
  bucket: string;
  maxBytes: number;
  /** Allowed content types. */
  types: readonly string[];
  /** What the purpose is called in a message. */
  label: string;
}

const images = ['image/jpeg', 'image/png', 'image/webp'] as const;
const office = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;
const sheets = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const filePurposeRules: Record<(typeof filePurposes)[number], FilePurposeRule> = {
  photo: { bucket: 'photos', maxBytes: 2 * MB, types: images, label: 'Photo' },
  document: {
    bucket: 'documents',
    maxBytes: 10 * MB,
    types: ['application/pdf', 'image/jpeg', 'image/png'],
    label: 'Document',
  },
  learning: {
    bucket: 'learning',
    maxBytes: 100 * MB,
    types: [...office, ...images, 'video/mp4'],
    label: 'Learning resource',
  },
  import: { bucket: 'imports', maxBytes: 20 * MB, types: sheets, label: 'Import file' },
  export: {
    bucket: 'exports',
    maxBytes: 200 * MB,
    types: [...sheets, 'application/pdf'],
    label: 'Export',
  },
  generated: {
    bucket: 'generated',
    maxBytes: 200 * MB,
    types: ['application/pdf'],
    label: 'Generated document',
  },
  knowledge: {
    bucket: 'knowledge',
    maxBytes: 50 * MB,
    types: ['application/pdf'],
    label: 'Textbook',
  },
  site: { bucket: 'site', maxBytes: 4 * MB, types: images, label: 'Website image' },
  payment_proof: {
    bucket: 'documents',
    maxBytes: 5 * MB,
    types: ['image/jpeg', 'image/png', 'application/pdf'],
    label: 'Proof of payment',
  },
};

/** The extension a stored file gets, by content type. The uploader's own file name is never used in a path. */
export const fileExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'video/mp4': 'mp4',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

export interface StorageBucket {
  name: string;
  /** Only the school website's images are public. */
  public: boolean;
  /** The largest file any purpose keeps in this bucket. */
  maxBytes: number;
}

/** Every bucket the product uses. */
export const storageBuckets: readonly StorageBucket[] = [
  ...new Set(Object.values(filePurposeRules).map((rule) => rule.bucket)),
]
  .sort()
  .map((name) => ({
    name,
    public: name === 'site',
    maxBytes: Math.max(
      ...Object.values(filePurposeRules)
        .filter((rule) => rule.bucket === name)
        .map((rule) => rule.maxBytes),
    ),
  }));

/** Body of `POST /files/uploads`. */
export const CreateUpload = z.object({
  purpose: FilePurpose,
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(120),
  size: z.int().min(1),
});
export type CreateUpload = z.output<typeof CreateUpload>;

/**
 * The answer of `POST /files/[id]/confirm`: the file is ready to use, or it was quarantined because
 * what arrived was empty, too large or not the kind of file that was announced.
 */
export type ConfirmedUpload =
  { id: string; status: 'ready' } | { id: string; status: 'quarantined'; reason: string };

/** What the client gets back: where to send the bytes, and until when. */
export interface UploadTicket {
  fileId: string;
  uploadUrl: string;
  expiresAt: string;
}
