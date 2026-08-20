import { afterEach, describe, expect, it } from 'vitest';
import { decryptSessionData, encryptSessionData } from '@/lib/session-encryption';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('session cookie encryption', () => {
  it('round-trips each purpose but rejects cross-purpose replay', () => {
    process.env.SESSION_ENCRYPTION_KEYS = `current:${'11'.repeat(32)}`;

    const session = encryptSessionData('{"ra":"123"}', 'session');
    const reconnect = encryptSessionData('{"senha":"secret"}', 'reconnect');
    const moodle = encryptSessionData('{"token":"moodle-token"}', 'moodle');

    expect(decryptSessionData(session, 'session')).toBe('{"ra":"123"}');
    expect(decryptSessionData(reconnect, 'reconnect')).toBe('{"senha":"secret"}');
    expect(decryptSessionData(moodle, 'moodle')).toBe('{"token":"moodle-token"}');
    expect(() => decryptSessionData(session, 'reconnect')).toThrow();
    expect(() => decryptSessionData(reconnect, 'session')).toThrow();
    expect(() => decryptSessionData(moodle, 'session')).toThrow();
    expect(() => decryptSessionData(session, 'moodle')).toThrow();
  });

  it('reads an older key from an explicit rotation keyring', () => {
    process.env.SESSION_ENCRYPTION_KEYS = `old:${'22'.repeat(32)}`;
    const cookie = encryptSessionData('rotating', 'session');

    process.env.SESSION_ENCRYPTION_KEYS = `new:${'33'.repeat(32)},old:${'22'.repeat(32)}`;
    expect(decryptSessionData(cookie, 'session')).toBe('rotating');
  });

  it('detects ciphertext tampering', () => {
    process.env.SESSION_ENCRYPTION_KEY = '44'.repeat(32);
    const cookie = encryptSessionData('sensitive', 'session');
    const parts = cookie.split('.');
    parts[4] = `${parts[4][0] === 'A' ? 'B' : 'A'}${parts[4].slice(1)}`;
    expect(() => decryptSessionData(parts.join('.'), 'session')).toThrow();
  });

  it('fails closed without a production key', () => {
    delete process.env.SESSION_ENCRYPTION_KEY;
    delete process.env.SESSION_ENCRYPTION_KEYS;
    process.env = {
      ...process.env,
      NODE_ENV: 'production',
      ALLOW_INSECURE_SESSION_KEY: 'true',
    };
    expect(() => encryptSessionData('blocked', 'session')).toThrow(/required/);
  });

  it.each([
    ['not-a-number'],
    ['2026-08-14T12:00:00Z'],
    [String(Date.now() + 31 * 24 * 60 * 60 * 1_000)],
  ])('rejects an invalid or unbounded legacy migration deadline (%s)', (deadline) => {
    process.env.SESSION_ENCRYPTION_PREVIOUS_KEY = '55'.repeat(32);
    process.env.SESSION_MIGRATION_MODE = 'compat';
    process.env.LEGACY_SESSION_COOKIE_ACCEPT_UNTIL = deadline;
    expect(() => decryptSessionData('00:00:00', 'session')).toThrow(/rejected/);
  });
});
