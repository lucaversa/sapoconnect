import { describe, expect, it, vi } from 'vitest';

import { ensurePersistentStorage } from '@/lib/pwa-storage';

describe('PWA storage persistence', () => {
  it('does not request persistence again when it is already granted', async () => {
    const persist = vi.fn(async () => true);
    const result = await ensurePersistentStorage({
      persisted: vi.fn(async () => true),
      persist,
    });

    expect(result).toBe('persistent');
    expect(persist).not.toHaveBeenCalled();
  });

  it('requests persistent mode for a best-effort origin', async () => {
    const persist = vi.fn(async () => true);
    const result = await ensurePersistentStorage({
      persisted: vi.fn(async () => false),
      persist,
    });

    expect(result).toBe('persistent');
    expect(persist).toHaveBeenCalledOnce();
  });

  it('keeps working when the browser does not support the Storage API', async () => {
    await expect(ensurePersistentStorage(undefined)).resolves.toBe('unsupported');
  });

  it('reports best-effort mode when the browser declines the request', async () => {
    const result = await ensurePersistentStorage({
      persisted: vi.fn(async () => false),
      persist: vi.fn(async () => false),
    });

    expect(result).toBe('best-effort');
  });
});
