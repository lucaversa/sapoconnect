import { getOrCreateDeviceId } from '@/lib/crypto';

export const FIRST_LOGIN_GUIDE_STORAGE_PREFIX = 'sapoconnect:onboarding:first-login:v1:';
export const COMMUNITY_ANNOUNCEMENT_STORAGE_KEY = 'sapoconnect:announcement:community-pulse-2026-08';

const COMMUNITY_ANNOUNCEMENT_COOKIE = 'sc_announcement_community_pulse_2026_08';
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashIdentity(value: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return bytesToHex(new Uint8Array(digest)).slice(0, 24);
  }

  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

export async function createFirstLoginGuideStorageKey(ra: string, deviceId: string): Promise<string> {
  const normalizedRa = ra.trim().replace(/\s+/g, '').toUpperCase();
  const identityHash = await hashIdentity(`${deviceId}:${normalizedRa}`);
  return `${FIRST_LOGIN_GUIDE_STORAGE_PREFIX}${identityHash}`;
}

export async function getFirstLoginGuideStorageKey(ra: string): Promise<string> {
  let deviceId = 'storage-restricted';
  try {
    deviceId = getOrCreateDeviceId();
  } catch {
    // A stable fallback still prevents the RA from appearing in storage keys.
  }
  return createFirstLoginGuideStorageKey(ra, deviceId);
}

function onboardingCookieName(storageKey: string): string {
  return `sc_first_login_${storageKey.slice(FIRST_LOGIN_GUIDE_STORAGE_PREFIX.length)}`;
}

function hasCookie(name: string): boolean {
  return document.cookie
    .split(';')
    .some((cookie) => cookie.trim().startsWith(`${name}=`));
}

function rememberCookie(name: string): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=seen; Max-Age=${ONE_YEAR_IN_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export function wasFirstLoginGuideSeen(storageKey: string): boolean {
  try {
    if (window.localStorage.getItem(storageKey) === 'seen') return true;
  } catch {
    // The non-sensitive cookie below is the fallback for restricted storage.
  }
  return hasCookie(onboardingCookieName(storageKey));
}

export function rememberFirstLoginGuide(storageKey: string): void {
  try {
    window.localStorage.setItem(storageKey, 'seen');
  } catch {
    // The non-sensitive cookie below keeps the one-time behavior available.
  }
  rememberCookie(onboardingCookieName(storageKey));
}

export function wasCommunityAnnouncementSeen(): boolean {
  try {
    if (window.localStorage.getItem(COMMUNITY_ANNOUNCEMENT_STORAGE_KEY) === 'seen') return true;
  } catch {
    // The cookie below is the fallback for restricted storage.
  }
  return hasCookie(COMMUNITY_ANNOUNCEMENT_COOKIE);
}

export function rememberCommunityAnnouncement(): void {
  try {
    window.localStorage.setItem(COMMUNITY_ANNOUNCEMENT_STORAGE_KEY, 'seen');
  } catch {
    // The non-sensitive cookie below keeps the one-time behavior available.
  }
  rememberCookie(COMMUNITY_ANNOUNCEMENT_COOKIE);
}
