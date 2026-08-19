import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolveAppTier } from '@/lib/server/app-tier';

afterEach(() => vi.unstubAllEnvs());

describe('server-side app tier targeting', () => {
  it('normalizes configured and session RAs before matching', () => {
    vi.stubEnv('SAPOCONNECT_LITE_RAS', 'SYNTH-RA-0002, 99887-66554');

    expect(resolveAppTier('SYNTH-RA-0002')).toBe('lite');
    expect(resolveAppTier('SYNTH-RA-0011')).toBe('lite');
    expect(resolveAppTier('SYNTH-RA-0001')).toBe('standard');
  });

  it('defaults to the standard experience when the private list is empty', () => {
    vi.stubEnv('SAPOCONNECT_LITE_RAS', '');

    expect(resolveAppTier('SYNTH-RA-0002')).toBe('standard');
    expect(resolveAppTier(null)).toBe('standard');
  });
});
