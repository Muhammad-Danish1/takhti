import { randomBytes, randomUUID } from 'node:crypto';

/**
 * A new record id: UUID version 7. The first 48 bits are the time in milliseconds, so ids made
 * later sort later, which keeps primary-key indexes compact. The rest is random.
 * Offline devices make ids the same way before they sync.
 */
export function newId(nowMs: number = Date.now()): string {
  const bytes = randomBytes(16);
  // 48-bit big-endian timestamp.
  bytes[0] = Math.floor(nowMs / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(nowMs / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(nowMs / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(nowMs / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(nowMs / 2 ** 8) & 0xff;
  bytes[5] = nowMs & 0xff;
  // Version 7 and the RFC 4122 variant.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A request id for logs, audit entries and error replies. */
export const newRequestId = (): string => randomUUID();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);
