import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { prepareLiteNavigation } from '@/components/login-form';

const VERSION_REQUEST = 'SAPOCONNECT_SW_VERSION';
const ARM_REQUEST = 'SAPOCONNECT_SW_ARM_LITE';

type WorkerMessage = { type?: string };
type TransferredPort = { postMessage(value: unknown): void };

function fakeWorker({
  version = 5,
  arm = true,
  beforeArmAck,
}: {
  version?: number;
  arm?: boolean;
  beforeArmAck?: () => void;
} = {}) {
  const postMessage = vi.fn((message: WorkerMessage, transfer?: Transferable[]) => {
    const port = transfer?.[0] as unknown as TransferredPort | undefined;
    if (message.type === VERSION_REQUEST) {
      port?.postMessage({ version });
      return;
    }
    if (message.type === ARM_REQUEST) {
      beforeArmAck?.();
      port?.postMessage({
        type: 'SAPOCONNECT_SW_ARM_LITE_ACK',
        armed: arm,
        version,
      });
    }
  });

  return { worker: { postMessage } as unknown as ServiceWorker, postMessage };
}

function installBrowserState(initialController: ServiceWorker | null) {
  let controller = initialController;
  const update = vi.fn(async () => undefined);
  const register = vi.fn(async () => ({ update }));
  const serviceWorker = {
    get controller() {
      return controller;
    },
    register,
  };

  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
  vi.stubGlobal('navigator', { serviceWorker });

  return {
    register,
    update,
    setController(nextController: ServiceWorker | null) {
      controller = nextController;
    },
  };
}

describe('Lite login service-worker arming', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('waits for a v5 controller to persist and acknowledge fail-closed state', async () => {
    const { worker, postMessage } = fakeWorker();
    const browser = installBrowserState(worker);

    await expect(prepareLiteNavigation(500)).resolves.toBe(true);

    expect(browser.register).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    expect(browser.update).toHaveBeenCalledOnce();
    expect(postMessage.mock.calls.map(([message]) => message.type)).toEqual([
      VERSION_REQUEST,
      ARM_REQUEST,
    ]);
  });

  it('repeats the version and arm handshake when the controller changes', async () => {
    const second = fakeWorker();
    const first = fakeWorker({
      beforeArmAck: () => browser.setController(second.worker),
    });
    const browser = installBrowserState(first.worker);

    await expect(prepareLiteNavigation(1_000)).resolves.toBe(true);

    expect(first.postMessage.mock.calls.map(([message]) => message.type)).toEqual([
      VERSION_REQUEST,
      ARM_REQUEST,
    ]);
    expect(second.postMessage.mock.calls.map(([message]) => message.type)).toEqual([
      VERSION_REQUEST,
      ARM_REQUEST,
    ]);
  });

  it('does not authorize navigation without a controlling worker', async () => {
    const browser = installBrowserState(null);

    await expect(prepareLiteNavigation(10)).resolves.toBe(false);

    expect(browser.register).toHaveBeenCalledOnce();
  });

  it('does not authorize navigation when persistence is not acknowledged', async () => {
    const { worker, postMessage } = fakeWorker({ arm: false });
    installBrowserState(worker);

    await expect(prepareLiteNavigation(50)).resolves.toBe(false);

    expect(postMessage.mock.calls.some(([message]) => message.type === ARM_REQUEST)).toBe(true);
  });
});
