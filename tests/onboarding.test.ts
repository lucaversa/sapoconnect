import { describe, expect, it } from 'vitest';

import {
  createFirstLoginGuideStorageKey,
  FIRST_LOGIN_GUIDE_STORAGE_PREFIX,
} from '@/lib/onboarding';

describe('first-login onboarding identity', () => {
  it('derives a stable per-installation key without exposing the RA', async () => {
    const ra = '12345.67890';
    const first = await createFirstLoginGuideStorageKey(ra, 'device-a');
    const repeated = await createFirstLoginGuideStorageKey(` ${ra} `, 'device-a');
    const otherDevice = await createFirstLoginGuideStorageKey(ra, 'device-b');

    expect(first).toBe(repeated);
    expect(first.startsWith(FIRST_LOGIN_GUIDE_STORAGE_PREFIX)).toBe(true);
    expect(first).not.toContain(ra);
    expect(otherDevice).not.toBe(first);
  });
});
