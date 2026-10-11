import { z } from 'zod';

/* Allowed-value lists of the shared kernel tables (M00). The tables build their check constraints from these. */

export const filePurposes = [
  'photo',
  'document',
  'learning',
  'import',
  'export',
  'generated',
  'knowledge',
  'site',
  'payment_proof',
] as const;
export const FilePurpose = z.enum(filePurposes);
export type FilePurpose = (typeof filePurposes)[number];

export const fileStatuses = ['pending', 'ready', 'quarantined', 'deleted'] as const;
export const FileStatus = z.enum(fileStatuses);
export type FileStatus = (typeof fileStatuses)[number];

export const documentLanguages = ['en', 'ur', 'both'] as const;
export const DocumentLanguage = z.enum(documentLanguages);
export type DocumentLanguage = (typeof documentLanguages)[number];

export const jobStatuses = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export const JobStatus = z.enum(jobStatuses);
export type JobStatus = (typeof jobStatuses)[number];

/** How a schedule becomes jobs: once for the platform, once per organisation, or once per branch. */
export const scheduleFanOuts = ['platform', 'per_org', 'per_branch'] as const;
export const ScheduleFanOut = z.enum(scheduleFanOuts);
export type ScheduleFanOut = (typeof scheduleFanOuts)[number];

export const approvalStatuses = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export const ApprovalStatus = z.enum(approvalStatuses);
export type ApprovalStatus = (typeof approvalStatuses)[number];

export const approvalStepStatuses = ['pending', 'approved', 'rejected', 'skipped'] as const;
export const ApprovalStepStatus = z.enum(approvalStepStatuses);
export type ApprovalStepStatus = (typeof approvalStepStatuses)[number];

export const importStatuses = [
  'uploaded',
  'validating',
  'ready',
  'committing',
  'completed',
  'failed',
  'cancelled',
] as const;
export const ImportStatus = z.enum(importStatuses);
export type ImportStatus = (typeof importStatuses)[number];

export const importRowStatuses = ['valid', 'invalid', 'created', 'skipped', 'failed'] as const;
export const ImportRowStatus = z.enum(importRowStatuses);
export type ImportRowStatus = (typeof importRowStatuses)[number];

export const exportFormats = ['csv', 'xlsx', 'pdf'] as const;
export const ExportFormat = z.enum(exportFormats);
export type ExportFormat = (typeof exportFormats)[number];

export const exportStatuses = ['queued', 'running', 'ready', 'failed', 'expired'] as const;
export const ExportStatus = z.enum(exportStatuses);
export type ExportStatus = (typeof exportStatuses)[number];

export const customFieldEntities = ['student', 'guardian', 'staff', 'admission'] as const;
export const CustomFieldEntity = z.enum(customFieldEntities);
export type CustomFieldEntity = (typeof customFieldEntities)[number];

export const customFieldTypes = ['text', 'number', 'date', 'select', 'bool'] as const;
export const CustomFieldType = z.enum(customFieldTypes);
export type CustomFieldType = (typeof customFieldTypes)[number];

export const noteVisibilities = ['staff', 'leaders'] as const;
export const NoteVisibility = z.enum(noteVisibilities);
export type NoteVisibility = (typeof noteVisibilities)[number];

export const findingSeverities = ['info', 'warning', 'critical'] as const;
export const FindingSeverity = z.enum(findingSeverities);
export type FindingSeverity = (typeof findingSeverities)[number];

export const findingStatuses = ['open', 'acknowledged', 'resolved'] as const;
export const FindingStatus = z.enum(findingStatuses);
export type FindingStatus = (typeof findingStatuses)[number];

export const syncDeviceStatuses = ['active', 'revoked'] as const;
export const SyncDeviceStatus = z.enum(syncDeviceStatuses);
export type SyncDeviceStatus = (typeof syncDeviceStatuses)[number];

export const syncOpResults = ['applied', 'rejected', 'conflict', 'duplicate'] as const;
export const SyncOpResult = z.enum(syncOpResults);
export type SyncOpResult = (typeof syncOpResults)[number];

export const syncConflictStatuses = ['open', 'kept_server', 'took_device', 'merged'] as const;
export const SyncConflictStatus = z.enum(syncConflictStatuses);
export type SyncConflictStatus = (typeof syncConflictStatuses)[number];
