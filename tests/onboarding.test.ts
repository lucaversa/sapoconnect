import { describe, expect, it } from 'vitest';

import {
  AVA_ANNOUNCEMENT_EXPIRES_AT,
  AVA_ANNOUNCEMENT_STARTS_AT,
  createFirstLoginGuideStorageKey,
  FIRST_LOGIN_GUIDE_STORAGE_PREFIX,
  isAvaAnnouncementActive,
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

describe('AVA announcement window', () => {
  it('stays active for exactly 15 days', () => {
    expect(AVA_ANNOUNCEMENT_EXPIRES_AT - AVA_ANNOUNCEMENT_STARTS_AT).toBe(15 * 24 * 60 * 60 * 1_000);
    expect(isAvaAnnouncementActive(AVA_ANNOUNCEMENT_STARTS_AT - 1)).toBe(false);
    expect(isAvaAnnouncementActive(AVA_ANNOUNCEMENT_STARTS_AT)).toBe(true);
    expect(isAvaAnnouncementActive(AVA_ANNOUNCEMENT_EXPIRES_AT - 1)).toBe(true);
    expect(isAvaAnnouncementActive(AVA_ANNOUNCEMENT_EXPIRES_AT)).toBe(false);
  });
});
