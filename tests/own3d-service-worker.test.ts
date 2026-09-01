import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const ORIGIN = 'https://sapoconnect.test';
const TARGET_HTML = '<!doctype html><main data-own3d-screen>own3d by tub1cs</main>';
const NORMAL_HTML = '<!doctype html><main>portal acadêmico</main>';

function cacheKey(input: string | Request): string {
  const value = typeof input === 'string' ? input : input.url;
  return new URL(value, ORIGIN).href;
}

class MemoryCache {
  readonly entries = new Map<string, Response>();

  async match(input: string | Request): Promise<Response | undefined> {
    return this.entries.get(cacheKey(input))?.clone();
  }

  async put(input: string | Request, response: Response): Promise<void> {
    this.entries.set(cacheKey(input), response.clone());
  }

  async delete(input: string | Request): Promise<boolean> {
    return this.entries.delete(cacheKey(input));
  }
}

class MemoryCacheStorage {
  readonly buckets = new Map<string, MemoryCache>();

  async open(name: string): Promise<MemoryCache> {
    const existing = this.buckets.get(name);
    if (existing) return existing;
    const cache = new MemoryCache();
    this.buckets.set(name, cache);
    return cache;
  }

  async keys(): Promise<string[]> {
    return Array.from(this.buckets.keys());
  }

  async delete(name: string): Promise<boolean> {
    return this.buckets.delete(name);
  }
}

interface ServiceWorkerTestApi {
  navigationResponse(request: Request): Promise<Response>;
  shellCacheName: string;
  own3dDocumentKey: string;
  own3dStateKey: string;
}

async function createHarness() {
  const source = await readFile(path.join(process.cwd(), 'public/sw.js'), 'utf8');
  const cacheStorage = new MemoryCacheStorage();
  const listeners = new Map<string, (event: { waitUntil(promise: Promise<unknown>): void }) => void>();
  const navigatorState = { onLine: true };
  const fetchMock = vi.fn<(request: Request) => Promise<Response>>();
  const selfObject: Record<string, unknown> = {
    location: { origin: ORIGIN },
    navigator: navigatorState,
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(async () => undefined),
    addEventListener: (type: string, listener: (event: { waitUntil(promise: Promise<unknown>): void }) => void) => {
      listeners.set(type, listener);
    },
  };
  const context = vm.createContext({
    caches: cacheStorage,
    fetch: fetchMock,
    Request,
    Response,
    URL,
    self: selfObject,
  });

  vm.runInContext(
    `${source}\nself.__test = { navigationResponse, shellCacheName: SHELL_CACHE, own3dDocumentKey: OWN3D_DOCUMENT_KEY, own3dStateKey: OWN3D_STATE_KEY };`,
    context
  );

  return {
    api: selfObject.__test as ServiceWorkerTestApi,
    caches: cacheStorage,
    fetchMock,
    listeners,
    navigatorState,
  };
}

function htmlResponse(html: string): Response {
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

describe('own3d service-worker isolation', () => {
  it('stores a target document outside pathname caches and replays it for every offline navigation', async () => {
    const harness = await createHarness();
    const cache = await harness.caches.open(harness.api.shellCacheName);
    await cache.put('/app', htmlResponse(NORMAL_HTML));
    harness.fetchMock.mockResolvedValue(htmlResponse(TARGET_HTML));

    const online = await harness.api.navigationResponse(new Request(`${ORIGIN}/app`));

    expect(await online.text()).toContain('own3d by tub1cs');
    expect(await cache.match('/app')).toBeUndefined();
    expect(await cache.match(harness.api.own3dStateKey)).toBeDefined();
    expect(await cache.match(harness.api.own3dDocumentKey)).toBeDefined();

    harness.navigatorState.onLine = false;
    harness.fetchMock.mockRejectedValue(new Error('offline'));
    const offline = await harness.api.navigationResponse(new Request(`${ORIGIN}/login`));

    expect(await offline.text()).toContain('own3d by tub1cs');
  });

  it('clears target state only after a normal account receives a normal document', async () => {
    const harness = await createHarness();
    const cache = await harness.caches.open(harness.api.shellCacheName);
    harness.fetchMock.mockResolvedValueOnce(htmlResponse(TARGET_HTML));
    await harness.api.navigationResponse(new Request(`${ORIGIN}/app`));

    harness.fetchMock.mockResolvedValueOnce(htmlResponse(NORMAL_HTML));
    const switched = await harness.api.navigationResponse(new Request(`${ORIGIN}/login`));

    expect(await switched.text()).toContain('portal acadêmico');
    expect(await cache.match(harness.api.own3dStateKey)).toBeUndefined();

    harness.navigatorState.onLine = false;
    harness.fetchMock.mockRejectedValueOnce(new Error('offline'));
    const offline = await harness.api.navigationResponse(new Request(`${ORIGIN}/app/faltas`));
    const offlineHtml = await offline.text();
    expect(offlineHtml).toContain('portal acadêmico');
    expect(offlineHtml).not.toContain('own3d by tub1cs');
  });

  it('fails closed when target state exists but its isolated document is unavailable', async () => {
    const harness = await createHarness();
    const cache = await harness.caches.open(harness.api.shellCacheName);
    await cache.put('/app', htmlResponse(NORMAL_HTML));
    await cache.put(harness.api.own3dStateKey, new Response('active'));
    harness.navigatorState.onLine = false;

    const response = await harness.api.navigationResponse(new Request(`${ORIGIN}/app`));

    expect(response.type).toBe('error');
    expect(await response.text()).not.toContain('portal acadêmico');
  });

  it('returns the fetched target screen and removes normal fallbacks when cache persistence fails', async () => {
    const harness = await createHarness();
    const cache = await harness.caches.open(harness.api.shellCacheName);
    await cache.put('/app', htmlResponse(NORMAL_HTML));
    const put = cache.put.bind(cache);
    vi.spyOn(cache, 'put').mockImplementation(async (input, response) => {
      if (cacheKey(input).endsWith(harness.api.own3dDocumentKey)) {
        throw new Error('quota exceeded');
      }
      await put(input, response);
    });
    harness.fetchMock.mockResolvedValue(htmlResponse(TARGET_HTML));

    const online = await harness.api.navigationResponse(new Request(`${ORIGIN}/app`));
    expect(await online.text()).toContain('own3d by tub1cs');
    expect(await cache.match('/app')).toBeUndefined();

    harness.navigatorState.onLine = false;
    const offline = await harness.api.navigationResponse(new Request(`${ORIGIN}/app`));
    expect(offline.type).toBe('error');
  });

  it('reports the current worker version through the activation handshake', async () => {
    const harness = await createHarness();
    const postMessage = vi.fn();
    const message = harness.listeners.get('message') as unknown as (event: {
      data: { type: string };
      ports: Array<{ postMessage: (value: unknown) => void }>;
    }) => void;

    message({ data: { type: 'SAPOCONNECT_SW_VERSION' }, ports: [{ postMessage }] });

    expect(postMessage).toHaveBeenCalledWith({ version: 4 });
  });

  it('purges stale personalized v3 caches when v4 activates', async () => {
    const harness = await createHarness();
    await harness.caches.open('sapoconnect-shell-v3');
    await harness.caches.open('sapoconnect-static-v3');
    await harness.caches.open(harness.api.shellCacheName);
    let activation: Promise<unknown> | undefined;

    harness.listeners.get('activate')?.({ waitUntil: (promise) => { activation = promise; } });
    await activation;

    expect(await harness.caches.keys()).toEqual([harness.api.shellCacheName]);
  });
});
