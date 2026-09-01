import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const ORIGIN = 'https://sapoconnect.test';
const LITE_HTML = '<!doctype html><main data-sapoconnect-lite="active">portal Lite</main>';
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

  async keys(): Promise<Request[]> {
    return Array.from(this.entries.keys(), (key) => new Request(key));
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
  liteStateKey: string;
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
    `${source}\nself.__test = { navigationResponse, shellCacheName: SHELL_CACHE, liteStateKey: LITE_STATE_KEY };`,
    context,
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

describe('SapoConnect Lite service-worker isolation', () => {
  it('never caches time-sensitive Lite HTML under a route pathname', async () => {
    const harness = await createHarness();
    const cache = await harness.caches.open(harness.api.shellCacheName);
    await cache.put('/app', htmlResponse(NORMAL_HTML));
    harness.fetchMock.mockResolvedValue(htmlResponse(LITE_HTML));

    const online = await harness.api.navigationResponse(new Request(`${ORIGIN}/app`));

    expect(await online.text()).toContain('portal Lite');
    expect(await cache.match('/app')).toBeUndefined();
    expect(await cache.match(harness.api.liteStateKey)).toBeDefined();
    expect(Array.from(cache.entries.values())).toHaveLength(1);
  });

  it('fails closed offline without replaying a normal shell or academic data', async () => {
    const harness = await createHarness();
    const cache = await harness.caches.open(harness.api.shellCacheName);
    await cache.put('/app', htmlResponse(NORMAL_HTML));
    await cache.put(harness.api.liteStateKey, new Response('active'));
    harness.navigatorState.onLine = false;

    const response = await harness.api.navigationResponse(new Request(`${ORIGIN}/app`));
    const html = await response.text();

    expect(response.status).toBe(503);
    expect(html).toContain('data-sapoconnect-lite="offline"');
    expect(html).toContain('Conecte-se para continuar');
    expect(html).not.toContain('portal acadêmico');
  });

  it('clears Lite state only after a normal account document is stored', async () => {
    const harness = await createHarness();
    const cache = await harness.caches.open(harness.api.shellCacheName);
    await cache.put(harness.api.liteStateKey, new Response('active'));
    harness.fetchMock.mockResolvedValue(htmlResponse(NORMAL_HTML));

    const switched = await harness.api.navigationResponse(new Request(`${ORIGIN}/app`));

    expect(await switched.text()).toContain('portal acadêmico');
    expect(await cache.match('/app')).toBeDefined();
    expect(await cache.match(harness.api.liteStateKey)).toBeUndefined();
  });

  it('keeps the previous account closed if normal document persistence fails', async () => {
    const harness = await createHarness();
    const cache = await harness.caches.open(harness.api.shellCacheName);
    await cache.put(harness.api.liteStateKey, new Response('active'));
    vi.spyOn(cache, 'put').mockRejectedValue(new Error('quota exceeded'));
    harness.fetchMock.mockResolvedValue(htmlResponse(NORMAL_HTML));

    const response = await harness.api.navigationResponse(new Request(`${ORIGIN}/app`));
    const html = await response.text();

    expect(response.status).toBe(503);
    expect(html).toContain('SapoConnect Lite');
    expect(html).not.toContain('portal acadêmico');
    expect(await cache.match(harness.api.liteStateKey)).toBeDefined();
  });

  it('reports worker v5 through the activation handshake', async () => {
    const harness = await createHarness();
    const postMessage = vi.fn();
    const message = harness.listeners.get('message') as unknown as (event: {
      data: { type: string };
      ports: Array<{ postMessage: (value: unknown) => void }>;
    }) => void;

    message({ data: { type: 'SAPOCONNECT_SW_VERSION' }, ports: [{ postMessage }] });

    expect(postMessage).toHaveBeenCalledWith({ version: 5 });
  });

  it('persists fail-closed Lite state before acknowledging login navigation', async () => {
    const harness = await createHarness();
    const cache = await harness.caches.open(harness.api.shellCacheName);
    await cache.put('/app', htmlResponse(NORMAL_HTML));
    await cache.put('/login', htmlResponse(NORMAL_HTML));
    const postMessage = vi.fn();
    let arming: Promise<unknown> | undefined;
    const message = harness.listeners.get('message') as unknown as (event: {
      data: { type: string };
      ports: Array<{ postMessage: (value: unknown) => void }>;
      waitUntil: (promise: Promise<unknown>) => void;
    }) => void;

    message({
      data: { type: 'SAPOCONNECT_SW_ARM_LITE' },
      ports: [{ postMessage }],
      waitUntil: (promise) => { arming = promise; },
    });
    await arming;

    expect(await cache.match(harness.api.liteStateKey)).toBeDefined();
    expect(await cache.match('/app')).toBeUndefined();
    expect(await cache.match('/login')).toBeUndefined();
    expect(postMessage).toHaveBeenCalledWith({
      type: 'SAPOCONNECT_SW_ARM_LITE_ACK',
      armed: true,
      version: 5,
    });
  });

  it('refuses the arm acknowledgement when persistent state cannot be written', async () => {
    const harness = await createHarness();
    const cache = await harness.caches.open(harness.api.shellCacheName);
    vi.spyOn(cache, 'put').mockRejectedValue(new Error('quota exceeded'));
    const postMessage = vi.fn();
    let arming: Promise<unknown> | undefined;
    const message = harness.listeners.get('message') as unknown as (event: {
      data: { type: string };
      ports: Array<{ postMessage: (value: unknown) => void }>;
      waitUntil: (promise: Promise<unknown>) => void;
    }) => void;

    message({
      data: { type: 'SAPOCONNECT_SW_ARM_LITE' },
      ports: [{ postMessage }],
      waitUntil: (promise) => { arming = promise; },
    });
    await arming;

    expect(await cache.match(harness.api.liteStateKey)).toBeUndefined();
    expect(postMessage).toHaveBeenCalledWith({
      type: 'SAPOCONNECT_SW_ARM_LITE_ACK',
      armed: false,
      version: 5,
    });
  });

  it('purges stale v4 caches when v5 activates', async () => {
    const harness = await createHarness();
    await harness.caches.open('sapoconnect-shell-v4');
    await harness.caches.open('sapoconnect-static-v4');
    await harness.caches.open(harness.api.shellCacheName);
    let activation: Promise<unknown> | undefined;

    harness.listeners.get('activate')?.({ waitUntil: (promise) => { activation = promise; } });
    await activation;

    expect(await harness.caches.keys()).toEqual([harness.api.shellCacheName]);
  });
});
