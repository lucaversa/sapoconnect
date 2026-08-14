import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getReconnectMigrationMode,
  markReconnectCookieConfirmed,
  resolveMigrationMarker,
} from '@/lib/storage';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('reconnect credential migration', () => {
  it('keeps dual mode as the explicit rollback-compatible default', () => {
    vi.stubEnv('NEXT_PUBLIC_RECONNECT_MIGRATION_MODE', '');
    expect(getReconnectMigrationMode()).toBe('dual');
    vi.stubEnv('NEXT_PUBLIC_RECONNECT_MIGRATION_MODE', 'cookie-only');
    expect(getReconnectMigrationMode()).toBe('cookie-only');
  });

  it('does not create new JavaScript-readable password copies and discloses the legacy window', () => {
    const loginSource = readFileSync(resolve('components/login-form.tsx'), 'utf8');
    const aboutSource = readFileSync(resolve('components/modals/AboutDialog.tsx'), 'utf8');

    expect(loginSource).not.toContain('saveCredentials');
    expect(loginSource).toContain('void markReconnectCookieConfirmed');
    expect(loginSource).toContain('IndexedDB');
    expect(loginSource).toContain('7 dias');
    expect(aboutSource).toContain('IndexedDB');
    expect(aboutSource).toContain('7 dias');
  });

  it('does not extend the seven-day legacy rollback window on each refresh', () => {
    const day = 24 * 60 * 60 * 1_000;
    const first = resolveMigrationMarker(undefined, 10 * day, 'scope-a');
    expect(first).toEqual({ confirmedAt: 10 * day, cacheScope: 'scope-a' });
    expect(resolveMigrationMarker(first ?? undefined, 16 * day, 'scope-b')).toEqual({
      confirmedAt: 10 * day,
      cacheScope: 'scope-b',
    });
    expect(resolveMigrationMarker(first ?? undefined, 17 * day, 'scope-b')).toBeNull();
  });

  it('treats an unavailable IndexedDB marker as best-effort', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(markReconnectCookieConfirmed('scope-a')).resolves.toBeUndefined();
  });
});
