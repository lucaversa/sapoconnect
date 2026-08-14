/** Server-side, versioned authenticated encryption for HttpOnly cookies. */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { ServerConfigurationError } from './server/configuration-error';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const MAX_LEGACY_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

type Key = { id: string; key: Buffer };
export type CookiePurpose = 'session' | 'reconnect';

function configuredKeyMaterial(): string {
  const configured = process.env.SESSION_ENCRYPTION_KEYS || process.env.SESSION_ENCRYPTION_KEY;
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_SESSION_KEY === 'true') {
    return '0'.repeat(64);
  }
  throw new ServerConfigurationError('SESSION_ENCRYPTION_KEY(S) is required');
}

function parseKeyring(purpose: CookiePurpose): Key[] {
  const raw = configuredKeyMaterial();
  const items = process.env.SESSION_ENCRYPTION_KEYS
    ? raw.split(',').map((item) => {
      const [id, value] = item.trim().split(':');
      return { id, value };
    })
    : [{ id: 'primary', value: raw.trim() }];
  const keyring = items.map(({ id, value }) => {
    if (!id || !/^[a-zA-Z0-9_-]{1,32}$/.test(id) || !/^[a-fA-F0-9]{64}$/.test(value ?? '')) {
      throw new ServerConfigurationError('Invalid SESSION_ENCRYPTION_KEYS configuration');
    }
    const master = Buffer.from(value, 'hex');
    const key = createHmac('sha256', master)
      .update(`sapoconnect:${VERSION}:${purpose}:subkey`)
      .digest();
    return { id, key };
  });
  const previous = process.env.SESSION_ENCRYPTION_PREVIOUS_KEY;
  if (previous) {
    if (!/^[a-fA-F0-9]{64}$/.test(previous)) {
      throw new ServerConfigurationError('Invalid SESSION_ENCRYPTION_PREVIOUS_KEY configuration');
    }
    keyring.push({
      id: 'primary',
      key: createHmac('sha256', Buffer.from(previous, 'hex'))
        .update(`sapoconnect:${VERSION}:${purpose}:subkey`)
        .digest(),
    });
  }
  if (!keyring.length) throw new ServerConfigurationError('SESSION_ENCRYPTION_KEY(S) is required');
  return keyring;
}

function aadFor(purpose: CookiePurpose): Buffer {
  return Buffer.from(`sapoconnect/${purpose}-cookie/${VERSION}`, 'utf8');
}

export function encryptSessionData(data: string, purpose: CookiePurpose = 'session'): string {
  const { id, key } = parseKeyring(purpose)[0];
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aadFor(purpose));
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  return [VERSION, id, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptSessionData(
  encryptedData: string,
  purpose: CookiePurpose = 'session'
): string {
  if (encryptedData.includes(':')) {
    if (purpose !== 'session') throw new Error('Legacy reconnect cookie rejected');
    return decryptLegacySessionData(encryptedData);
  }
  const [version, id, ivValue, tagValue, ciphertext] = encryptedData.split('.');
  if (version !== VERSION || !id || !ivValue || !tagValue || !ciphertext) throw new Error('Invalid session cookie format');
  const candidates = parseKeyring(purpose).filter((candidate) => candidate.id === id);
  if (!candidates.length) throw new Error('Unknown session cookie key id');
  for (const { key } of candidates) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivValue, 'base64url'));
      decipher.setAAD(aadFor(purpose));
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // A matching id may refer to the previous single-key configuration.
    }
  }
  throw new Error('Unable to authenticate session cookie');
}

function decryptLegacySessionData(value: string): string {
  const rawUntil = process.env.LEGACY_SESSION_COOKIE_ACCEPT_UNTIL ?? '';
  const until = /^\d{13}$/.test(rawUntil) ? Number(rawUntil) : Number.NaN;
  const keyValue = process.env.SESSION_ENCRYPTION_PREVIOUS_KEY;
  const now = Date.now();
  if (
    !keyValue ||
    !Number.isFinite(until) ||
    until <= now ||
    until - now > MAX_LEGACY_WINDOW_MS ||
    process.env.SESSION_MIGRATION_MODE !== 'compat'
  ) throw new Error('Legacy session cookie rejected');
  const [ivHex, tagHex, ciphertext] = value.split(':');
  if (!ivHex || !tagHex || !ciphertext) throw new Error('Invalid legacy session cookie format');
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(keyValue, 'hex'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]).toString('utf8');
}

export function serializeSessionData(data: object): string { return JSON.stringify(data); }
export function deserializeSessionData<T>(data: string): T { return JSON.parse(data) as T; }
