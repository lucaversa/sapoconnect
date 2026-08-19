import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolveAppTier } from '@/lib/server/app-tier';

afterEach(() => vi.unstubAllEnvs());

describe('server-side app tier targeting', () => {
  it('normalizes configured and session RAs before matching', () => {
    vi.stubEnv('SAPOCONNECT_LITE_RAS', '12345.67890, 99887-66554');

    expect(resolveAppTier('1234567890')).toBe('lite');
    expect(resolveAppTier('99887.66554')).toBe('lite');
    expect(resolveAppTier('11111.22222')).toBe('standard');
  });

  it('defaults to the standard experience when the private list is empty', () => {
    vi.stubEnv('SAPOCONNECT_LITE_RAS', '');

    expect(resolveAppTier('12345.67890')).toBe('standard');
    expect(resolveAppTier(null)).toBe('standard');
  });
});
