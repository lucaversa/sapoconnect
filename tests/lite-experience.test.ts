import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createLiteClockAnchor,
  formatLiteRemainingTime,
  getLiteRemainingMs,
  isLiteAccessSnapshot,
} from '@/components/lite/lite-clock';
import {
  ownsFallbackLeaderLease,
  resolveFallbackLeaderLease,
  selectFallbackCoordinationBackend,
  shouldApplyLiteSnapshot,
} from '@/components/lite-experience-gate';
import type { LiteAccessSnapshot } from '@/lib/lite-policy';

const projectFile = (relativePath: string) => path.join(process.cwd(), relativePath);

const ACTIVE_SNAPSHOT: LiteAccessSnapshot = {
  tier: 'lite',
  state: 'active',
  serverNow: 1_000_000,
  startedAt: 1_000_000,
  expiresAt: 1_180_000,
  consumedMs: 0,
  remainingMs: 180_000,
  running: true,
  leaseUntil: 1_003_000,
  resetAt: 86_400_000,
};

describe('SapoConnect Lite frontend', () => {
  it('derives the countdown from server remaining time and a monotonic clock', () => {
    const anchor = createLiteClockAnchor(ACTIVE_SNAPSHOT, 500);

    expect(getLiteRemainingMs(anchor, 500)).toBe(180_000);
    expect(getLiteRemainingMs(anchor, 60_500)).toBe(120_000);
    expect(getLiteRemainingMs(anchor, 200_500)).toBe(0);
    expect(getLiteRemainingMs(anchor, 400)).toBe(180_000);
  });

  it('formats a countdown without showing zero before the final fraction expires', () => {
    expect(formatLiteRemainingTime(180_000)).toBe('03:00');
    expect(formatLiteRemainingTime(179_001)).toBe('03:00');
    expect(formatLiteRemainingTime(179_000)).toBe('02:59');
    expect(formatLiteRemainingTime(1)).toBe('00:01');
    expect(formatLiteRemainingTime(0)).toBe('00:00');
  });

  it('requires the server lease fields in Lite snapshots', () => {
    expect(isLiteAccessSnapshot(ACTIVE_SNAPSHOT)).toBe(true);
    expect(isLiteAccessSnapshot({ ...ACTIVE_SNAPSHOT, running: undefined })).toBe(false);
    expect(isLiteAccessSnapshot({ ...ACTIVE_SNAPSHOT, leaseUntil: undefined })).toBe(false);
    expect(isLiteAccessSnapshot({ ...ACTIVE_SNAPSHOT, consumedMs: undefined })).toBe(false);
  });

  it('elects exactly one fallback leader across serialized tab claims', () => {
    const firstClaim = resolveFallbackLeaderLease(null, 'tab-a', 1_000);
    const competingClaim = resolveFallbackLeaderLease(firstClaim, 'tab-b', 1_001);

    expect(firstClaim.owner).toBe('tab-a');
    expect(competingClaim.owner).toBe('tab-a');

    const claimAfterExpiry = resolveFallbackLeaderLease(
      competingClaim,
      'tab-b',
      competingClaim.expiresAt
    );
    expect(claimAfterExpiry.owner).toBe('tab-b');
    expect(ownsFallbackLeaderLease(claimAfterExpiry, 'tab-a', claimAfterExpiry.expiresAt - 1))
      .toBe(false);
    expect(ownsFallbackLeaderLease(claimAfterExpiry, 'tab-b', claimAfterExpiry.expiresAt - 1))
      .toBe(true);

    const staleLeaderRetry = resolveFallbackLeaderLease(
      claimAfterExpiry,
      'tab-a',
      claimAfterExpiry.expiresAt - 1
    );
    expect(staleLeaderRetry.owner).toBe('tab-b');

    const reverseFirstClaim = resolveFallbackLeaderLease(null, 'tab-b', 2_000);
    const reverseCompetingClaim = resolveFallbackLeaderLease(
      reverseFirstClaim,
      'tab-a',
      2_001
    );
    expect(reverseCompetingClaim.owner).toBe('tab-b');
  });

  it('chooses one coordination backend and fails closed after IndexedDB selection', () => {
    expect(selectFallbackCoordinationBackend(true)).toBe('indexeddb');
    expect(selectFallbackCoordinationBackend(false)).toBe('local-storage');
  });

  it('does not switch to localStorage after a transient IndexedDB failure', async () => {
    const gate = await readFile(projectFile('components/lite-experience-gate.tsx'), 'utf8');
    const claimImplementation = gate.slice(
      gate.indexOf('async function claimFallbackLeadership'),
      gate.indexOf('async function renewFallbackLeadership')
    );
    const renewImplementation = gate.slice(
      gate.indexOf('async function renewFallbackLeadership'),
      gate.indexOf('async function releaseFallbackLeadership')
    );

    expect(claimImplementation).toMatch(
      /catch \{\s+\/\/ Do not split coordination across backends[\s\S]*?return false;/
    );
    expect(renewImplementation).toMatch(
      /catch \{\s+\/\/ Fail closed until the selected coordination backend recovers[\s\S]*?return false;/
    );
  });

  it('rejects inverted server responses after a newer snapshot was applied', () => {
    expect(shouldApplyLiteSnapshot(5_000, 5_001)).toBe(true);
    expect(shouldApplyLiteSnapshot(5_000, 5_000)).toBe(true);
    expect(shouldApplyLiteSnapshot(5_000, 4_999)).toBe(false);
  });

  it('gates private providers behind the daily Lite experience', async () => {
    const layout = await readFile(projectFile('app/app/layout.tsx'), 'utf8');

    expect(layout).toContain('await getCurrentLiteAccessSnapshot()');
    expect(layout).toContain("initialLiteAccess.state === 'locked'");
    expect(layout.indexOf('<LiteExperienceGate')).toBeLessThan(layout.indexOf('<Providers>'));
    expect(layout).not.toContain('Own3d');
  });

  it('marks all Lite document states for isolated service worker handling', async () => {
    const rootLayout = await readFile(projectFile('app/layout.tsx'), 'utf8');
    const gate = await readFile(projectFile('components/lite-experience-gate.tsx'), 'utf8');
    const intro = await readFile(projectFile('components/lite/LiteIntroNotice.tsx'), 'utf8');
    const locked = await readFile(projectFile('components/lite/LiteLockedScreen.tsx'), 'utf8');

    expect(rootLayout).toContain('data-sapoconnect-lite={liteAccess.state}');
    expect(gate).toContain('data-sapoconnect-lite="active"');
    expect(intro).toContain('data-sapoconnect-lite="intro"');
    expect(locked).toContain('data-sapoconnect-lite="locked"');
  });

  it('shows the requested notice, timer watermark, and Premium message', async () => {
    const sources = await Promise.all(
      [
        'components/lite/LiteIntroNotice.tsx',
        'components/lite/LiteResumeScreen.tsx',
        'components/lite/LiteWatermark.tsx',
        'components/lite/LiteLockedScreen.tsx',
      ].map((relativePath) => readFile(projectFile(relativePath), 'utf8'))
    );
    const source = sources.join('\n');

    expect(source).toContain('SapoConnect Lite');
    expect(source).toContain('Começar meus 3 minutos');
    expect(source).toContain('O tempo só corre enquanto o SapoConnect estiver aberto e visível.');
    expect(source).toContain('Pausado');
    expect(source).toContain('Retomando seu acesso');
    expect(source).toContain('role="timer"');
    expect(source).toContain(
      'Para desbloquear o SapoConnect Premium, entre em contato com os donos do projeto.'
    );
    expect(source).not.toContain('own3d');
    expect(source).not.toContain('tub1cs');
    expect(source).not.toContain('—');
  });

  it('runs a leased heartbeat only while visible and holds Providers while paused', async () => {
    const gate = await readFile(projectFile('components/lite-experience-gate.tsx'), 'utf8');

    expect(gate).toContain('const HEARTBEAT_INTERVAL_MS = 1_000');
    expect(gate).toContain("runAction('resume', false");
    expect(gate).toContain("runAction('heartbeat', false");
    expect(gate).toContain("runAction('pause', true)");
    expect(gate).toContain("document.addEventListener('visibilitychange'");
    expect(gate).toContain("window.addEventListener('pagehide'");
    expect(gate).toContain('navigator.locks');
    expect(gate).toContain("database.transaction(FALLBACK_STORE_NAME, 'readwrite')");
    expect(gate).toContain('claimFallbackLeadership(fallbackOwner)');
    expect(gate).toContain('renewFallbackLeadership(fallbackOwner)');
    expect(gate).toContain('verifyHeartbeatLeadership');
    expect(gate).toContain('verifyPauseLeadership');
    expect(gate).toContain('if (mayPause)');
    expect(gate).toContain('Do not split coordination across backends');
    expect(gate).toContain('ACTION_TIMEOUT_MS[action]');
    expect(gate).toContain('FALLBACK_COORDINATION_TIMEOUT_MS');
    expect(gate).toContain('leadershipAbortController?.abort()');
    expect(gate).toContain("await runAction('pause', true).catch");
    expect(gate).toContain('await releaseCoordination?.().catch');
    expect(gate).toContain('pauseInitialLiteSnapshot(initialSnapshot)');
    expect(gate).toContain('const hasLiveLease =');
    expect(gate).toContain('if (!snapshot.running) return <LiteResumeScreen');
    expect(gate.indexOf('if (!snapshot.running)')).toBeLessThan(
      gate.indexOf('data-sapoconnect-lite="active"')
    );
  });
});
