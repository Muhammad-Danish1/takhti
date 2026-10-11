import { z } from 'zod';
import type { ApiErrorBody, ErrorCode } from '@school/contracts';

const httpStatus: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  STALE: 409,
  RULE: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/** The only error type services throw on purpose. Anything else is treated as a bug (500). */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (label: string) => new AppError('NOT_FOUND', `${label} not found`);
export const forbidden = (message = 'You are not allowed to do this') => new AppError('FORBIDDEN', message);
/** A business rule said no, e.g. `throw rule('This voucher is already paid')`. */
export const rule = (message: string) => new AppError('RULE', message);

/** Database error codes we can explain to the user. Postgres raises these when a constraint stops a write. */
const postgresErrors: Record<string, { code: ErrorCode; message: string }> = {
  '23505': { code: 'CONFLICT', message: 'That value is already in use' },
  '23503': { code: 'CONFLICT', message: 'This record is linked to other records' },
  '23502': { code: 'VALIDATION', message: 'A required value is missing' },
  '23514': { code: 'VALIDATION', message: 'A value is outside the allowed range' },
  '42501': { code: 'FORBIDDEN', message: 'You are not allowed to do this' },
  '40001': { code: 'CONFLICT', message: 'The record changed while saving. Try again.' },
  '40P01': { code: 'CONFLICT', message: 'The record changed while saving. Try again.' },
};

/** Drizzle wraps the driver's error, so the Postgres code can sit one or two `cause` levels down. */
function findPostgresError(error: unknown): { code: string; message: string } | undefined {
  for (let e = error; typeof e === 'object' && e !== null; e = (e as { cause?: unknown }).cause) {
    const { code, message } = e as { code?: unknown; message?: unknown };
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
      return { code, message: typeof message === 'string' ? message : '' };
    }
  }
  return undefined;
}

/**
 * Turns anything thrown into the one error shape the API returns.
 * Used by the route layer, the offline sync upload and background jobs, so all three report failures the same way.
 */
export function toErrorResponse(error: unknown, requestId: string): { status: number; body: ApiErrorBody } {
  const reply = (code: ErrorCode, message: string, fields?: Record<string, string[]>) => ({
    status: httpStatus[code],
    body: { error: { code, message, ...(fields && { fields }), requestId } },
  });

  if (error instanceof AppError) return reply(error.code, error.message, error.fields);

  if (error instanceof z.ZodError) {
    return reply('VALIDATION', 'Some fields need attention', z.flattenError(error).fieldErrors);
  }

  const pg = findPostgresError(error);
  if (pg) {
    // P0001 is a `raise exception` from our own SQL: its text is a business rule written for the user.
    if (pg.code === 'P0001') return reply('RULE', pg.message);
    const known = postgresErrors[pg.code];
    if (known) return reply(known.code, known.message);
  }

  console.error(`[${requestId}]`, error);
  return reply('INTERNAL', 'Something went wrong on our side');
}
