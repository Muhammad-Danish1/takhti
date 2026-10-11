import { z } from 'zod';
import {
  httpStatusByCode,
  type ApiErrorBody,
  type ErrorCode,
  type FieldErrors,
} from '@takhti/contracts';

/** The only error type services throw on purpose. Anything else is treated as a bug (500). */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: FieldErrors,
    /** Seconds until a rate-limited caller may try again. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (label: string) => new AppError('NOT_FOUND', `${label} not found`);
export const forbidden = (message = 'You are not allowed to do this') =>
  new AppError('FORBIDDEN', message);
/** A business rule said no, e.g. `throw rule('This voucher is already paid')`. */
export const rule = (message: string) => new AppError('RULE', message);
/** The input is wrong in a way the contract could not catch: `throw invalid({ gradeTo: ['Must not be before the first grade'] })`. */
export const invalid = (fields: FieldErrors, message = 'Some fields need attention') =>
  new AppError('VALIDATION', message, fields);
export const conflict = (message: string, fields?: FieldErrors) =>
  new AppError('CONFLICT', message, fields);
export const stale = (label: string) =>
  new AppError('STALE', `${label} was changed by someone else. Reload and try again.`);
export const unauthenticated = (message = 'Please sign in again') =>
  new AppError('UNAUTHENTICATED', message);
export const rateLimited = (retryAfterSeconds: number) =>
  new AppError(
    'RATE_LIMITED',
    `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
    undefined,
    retryAfterSeconds,
  );

/** Database error codes we can explain to the user. Postgres raises these when a constraint stops a write. */
const postgresErrors: Record<string, { code: ErrorCode; message: string }> = {
  '23505': { code: 'CONFLICT', message: 'That value is already in use' },
  '23503': { code: 'CONFLICT', message: 'This record is linked to other records' },
  '23502': { code: 'VALIDATION', message: 'A required value is missing' },
  '23514': { code: 'VALIDATION', message: 'A value is outside the allowed range' },
  '23P01': { code: 'CONFLICT', message: 'This overlaps something that already exists' },
  '22001': { code: 'VALIDATION', message: 'A value is too long' },
  '22003': { code: 'VALIDATION', message: 'A number is out of range' },
  '22P02': { code: 'VALIDATION', message: 'A value has the wrong format' },
  '42501': { code: 'FORBIDDEN', message: 'You are not allowed to do this' },
  '40001': { code: 'CONFLICT', message: 'The record changed while saving. Try again.' },
  '40P01': { code: 'CONFLICT', message: 'The record changed while saving. Try again.' },
};

/**
 * Friendly text for named constraints, so a duplicate admission number says
 * "Admission number is already in use" under the right field instead of the generic message.
 * Each module registers the messages for its own unique indexes and checks.
 */
const constraintMessages = new Map<string, { message: string; field?: string }>();

export function registerConstraintMessages(
  messages: Record<string, string | { message: string; field: string }>,
): void {
  for (const [constraint, value] of Object.entries(messages)) {
    constraintMessages.set(constraint, typeof value === 'string' ? { message: value } : value);
  }
}

interface PostgresError {
  code: string;
  message: string;
  constraint?: string;
}

/** Drizzle wraps the driver's error, so the Postgres code can sit one or two `cause` levels down. */
export function findPostgresError(error: unknown): PostgresError | undefined {
  for (
    let e = error, depth = 0;
    typeof e === 'object' && e !== null && depth < 6;
    e = (e as { cause?: unknown }).cause, depth++
  ) {
    const {
      code,
      message,
      constraint,
      constraint_name: constraintName,
    } = e as {
      code?: unknown;
      message?: unknown;
      constraint?: unknown;
      constraint_name?: unknown;
    };
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
      const name =
        typeof constraint === 'string'
          ? constraint
          : typeof constraintName === 'string'
            ? constraintName
            : undefined;
      return {
        code,
        message: typeof message === 'string' ? message : '',
        ...(name && { constraint: name }),
      };
    }
  }
  return undefined;
}

export interface ErrorReply {
  status: number;
  body: ApiErrorBody;
  retryAfterSeconds?: number;
  /** True when the error was not expected: the caller should log it with its stack. */
  unexpected: boolean;
}

/**
 * Turns anything thrown into the one error shape the API returns.
 * Used by the route layer, the offline sync upload and background jobs, so all three report failures the same way.
 */
export function toErrorResponse(error: unknown, requestId: string): ErrorReply {
  const reply = (
    code: ErrorCode,
    message: string,
    fields?: FieldErrors,
    extra: Partial<ErrorReply> = {},
  ): ErrorReply => ({
    status: httpStatusByCode[code],
    body: { error: { code, message, ...(fields && { fields }), requestId } },
    unexpected: false,
    ...extra,
  });

  if (error instanceof AppError) {
    return reply(error.code, error.message, error.fields, {
      ...(error.retryAfterSeconds !== undefined && { retryAfterSeconds: error.retryAfterSeconds }),
    });
  }

  if (error instanceof z.ZodError) {
    const flat = z.flattenError(error);
    const fields: FieldErrors = { ...(flat.fieldErrors as FieldErrors) };
    if (flat.formErrors.length > 0) fields._ = flat.formErrors;
    return reply('VALIDATION', 'Some fields need attention', fields);
  }

  const pg = findPostgresError(error);
  if (pg) {
    // P0001 is a `raise exception` from our own SQL: its text is a business rule written for the user.
    if (pg.code === 'P0001') return reply('RULE', pg.message);
    const known = postgresErrors[pg.code];
    if (known) {
      const named = pg.constraint ? constraintMessages.get(pg.constraint) : undefined;
      if (named)
        return reply(
          known.code,
          named.message,
          named.field ? { [named.field]: [named.message] } : undefined,
        );
      return reply(known.code, known.message);
    }
  }

  return reply('INTERNAL', 'Something went wrong on our side', undefined, { unexpected: true });
}
