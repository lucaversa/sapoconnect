import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const sessionMocks = vi.hoisted(() => ({ getSession: vi.fn() }));
const usageMocks = vi.hoisted(() => ({
  getLiteAccessSnapshotForRa: vi.fn(),
  updateLiteAccessForRa: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: sessionMocks.getSession }));
vi.mock('@/lib/server/lite-usage', () => usageMocks);

import { GET, POST } from '@/app/api/lite/route';

const snapshot = {
  tier: 'lite',
  state: 'active',
  serverNow: 1_788_000_000_000,
  startedAt: 1_788_000_000_000,
  expiresAt: 1_788_000_180_000,
  consumedMs: 0,
  remainingMs: 180_000,
  running: true,
  leaseUntil: 1_788_000_003_000,
  resetAt: 1_788_040_800_000,
};

function postRequest(
  origin = 'https://app.example.com',
  action: string = 'start'
) {
  return new Request('https://app.example.com/api/lite', {
    method: 'POST',
    headers: {
      origin,
      'sec-fetch-site': origin === 'https://app.example.com' ? 'same-origin' : 'cross-site',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ action }),
  });
}

describe('/api/lite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usageMocks.getLiteAccessSnapshotForRa.mockResolvedValue(snapshot);
    usageMocks.updateLiteAccessForRa.mockResolvedValue(snapshot);
  });

  it('requires an active session', async () => {
    sessionMocks.getSession.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'SESSION_MISSING' });
  });

  it('returns a private server snapshot and repairs an invalid ledger', async () => {
    sessionMocks.getSession.mockResolvedValue({ ra: 'SYNTH-A.00001' });
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(usageMocks.getLiteAccessSnapshotForRa).toHaveBeenCalledWith(
      'SYNTH-A.00001',
      expect.any(Number),
      { repairInvalid: true }
    );
    await expect(response.json()).resolves.toEqual(snapshot);
  });

  it.each(['start', 'resume', 'heartbeat', 'pause'])(
    'applies the %s action for a same-origin request',
    async (action) => {
      sessionMocks.getSession.mockResolvedValue({ ra: 'SYNTH-B.00001' });
      const response = await POST(postRequest('https://app.example.com', action));

      expect(response.status).toBe(200);
      expect(usageMocks.updateLiteAccessForRa).toHaveBeenCalledWith(
        'SYNTH-B.00001',
        action
      );
      await expect(response.json()).resolves.toEqual(snapshot);
    }
  );

  it('rejects an unknown action before touching the session', async () => {
    const response = await POST(postRequest('https://app.example.com', 'restart'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_LITE_ACTION' });
    expect(sessionMocks.getSession).not.toHaveBeenCalled();
  });

  it('rejects a cross-origin start before touching the session', async () => {
    const response = await POST(postRequest('https://evil.example'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'ORIGIN_REJECTED' });
    expect(sessionMocks.getSession).not.toHaveBeenCalled();
    expect(usageMocks.updateLiteAccessForRa).not.toHaveBeenCalled();
  });
});
