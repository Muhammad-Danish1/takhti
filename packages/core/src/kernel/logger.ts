import pino, { type Logger as PinoLogger } from 'pino';

/*
 * One logger. JSON in production, readable locally. Every line a request writes carries its
 * request id, organisation and user, added once in `context.ts`.
 * Request bodies, tokens, identity numbers and phone numbers are never logged: the redaction list
 * below is a safety net, and code is written not to pass them in the first place.
 */

export type Logger = PinoLogger;

const redact = {
  paths: [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'secret',
    'apiKey',
    'cnic',
    'bFormNo',
    'phone',
    'email',
    'accountNo',
    'iban',
    '*.password',
    '*.token',
    '*.authorization',
    '*.cookie',
    '*.secret',
    '*.apiKey',
    '*.cnic',
    '*.bFormNo',
    '*.phone',
    '*.email',
    '*.accountNo',
    '*.iban',
    'headers.authorization',
    'headers.cookie',
  ],
  censor: '•••',
};

function build(): Logger {
  const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info');
  const pretty =
    process.env.APP_ENV !== 'production' &&
    process.env.APP_ENV !== 'staging' &&
    process.env.NODE_ENV !== 'test';
  return pino({
    level,
    redact,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(pretty && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    }),
  });
}

let root: Logger | undefined;

/** The root logger. Prefer `ctx.log` inside a request or job. */
export function logger(): Logger {
  root ??= build();
  return root;
}

/** A logger whose every line carries the given fields. */
export const childLogger = (fields: Record<string, unknown>): Logger => logger().child(fields);

/** For tests: replace the logger, for example with one that records lines. */
export function setLoggerForTests(next: Logger | undefined): void {
  root = next;
}
