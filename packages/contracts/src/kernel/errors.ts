/** Every failure the API can report. The client switches on `code`, never on the message text. */
export const errorCodes = [
  'UNAUTHENTICATED', // 401  not signed in, or the session expired
  'FORBIDDEN', //       403  signed in, but not allowed
  'NOT_FOUND', //       404
  'VALIDATION', //      422  the input is wrong; `fields` says where
  'CONFLICT', //        409  duplicate value, or the record is still linked to others
  'STALE', //           409  someone else changed the record first
  'RULE', //            409  a business rule said no ("fee already paid")
  'RATE_LIMITED', //    429
  'INTERNAL', //        500  our bug; `requestId` finds it in the logs
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export const httpStatusByCode: Record<ErrorCode, number> = {
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

/** Field name → messages, ready to show under form inputs. */
export type FieldErrors = Record<string, string[]>;

/** Body of every failed response. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fields?: FieldErrors;
    requestId: string;
  };
}

/** Body of every successful response. */
export interface ApiSuccessBody<T> {
  data: T;
}
