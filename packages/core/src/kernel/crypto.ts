import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/*
 * Tokens are stored hashed: a leaked database row cannot be used as a token.
 * Integration credentials are stored encrypted with a key from the environment (AES-256-GCM).
 */

/** A random, URL-safe token: for invitation links, verification codes on documents, API keys. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/** A short numeric code, for example a 4-digit gate-pass code. Uniform over its range. */
export function randomDigits(length: number): string {
  if (length < 1 || length > 12) throw new Error('A numeric code has 1 to 12 digits');
  let code = '';
  while (code.length < length) {
    const byte = randomBytes(1)[0] ?? 0;
    // Reject 250–255 so each digit is equally likely.
    if (byte < 250) code += String(byte % 10);
  }
  return code;
}

/** A short code from the given letters and digits, each equally likely: a device code, a pickup code. */
export function randomCode(length: number, alphabet: string): string {
  if (length < 1 || length > 32) throw new Error('A code has 1 to 32 characters');
  if (alphabet.length < 2 || alphabet.length > 256) throw new Error('An alphabet has 2 to 256 characters');
  // The largest multiple of the alphabet's size that fits in a byte; anything above it is thrown away.
  const limit = 256 - (256 % alphabet.length);
  let code = '';
  while (code.length < length) {
    const byte = randomBytes(1)[0] ?? 0;
    if (byte < limit) code += alphabet.charAt(byte % alphabet.length);
  }
  return code;
}

/** SHA-256 of a token, hex. What is stored instead of the token. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

/** SHA-256 of any content, hex. Used for file checksums and document content hashes. */
export const sha256 = (content: string | Uint8Array): string =>
  createHash('sha256').update(content).digest('hex');

/** Compares a presented token with a stored hash without leaking how many characters matched. */
export function tokenMatches(token: string, storedHash: string): boolean {
  const presented = Buffer.from(hashToken(token), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return presented.length === stored.length && timingSafeEqual(presented, stored);
}

/** HMAC-SHA256 of a message, hex. Used to sign outgoing webhooks and check incoming ones. */
export const hmacSha256 = (secret: string, message: string | Uint8Array): string =>
  createHmac('sha256', secret).update(message).digest('hex');

/** Constant-time comparison of two hex signatures. */
export function signatureMatches(expectedHex: string, presentedHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const presented = Buffer.from(presentedHex, 'hex');
  return (
    expected.length > 0 &&
    expected.length === presented.length &&
    timingSafeEqual(expected, presented)
  );
}

const KEY_BYTES = 32;
const IV_BYTES = 12;
const VERSION = 'v1';

function loadKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== KEY_BYTES) throw new Error('ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return key;
}

/**
 * Encrypts a secret for storage. The result carries a version, the nonce and the authentication tag:
 * `v1.<iv>.<tag>.<ciphertext>`, all base64url. A fresh nonce is used every time.
 */
export function encryptSecret(plain: string, keyBase64: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', loadKey(keyBase64), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    VERSION,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

/** Reverses `encryptSecret`. Throws if the value was altered or the key is wrong. */
export function decryptSecret(stored: string, keyBase64: string): string {
  const [version, iv, tag, encrypted] = stored.split('.');
  if (version !== VERSION || !iv || !tag || encrypted === undefined)
    throw new Error('Not an encrypted secret');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    loadKey(keyBase64),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** `35202-1234567-1` becomes `•••••-•••••67-1`: enough to recognise, not enough to misuse. */
export function maskIdentity(value: string, visible = 3): string {
  const characters = [...value];
  let seen = 0;
  for (let index = characters.length - 1; index >= 0; index--) {
    if (!/[0-9A-Za-z]/.test(characters[index] ?? '')) continue;
    seen += 1;
    if (seen > visible) characters[index] = '•';
  }
  return characters.join('');
}
