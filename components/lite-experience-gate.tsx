'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  LiteIntroNotice,
  LiteLockedScreen,
  LiteResumeScreen,
  LiteWatermark,
} from '@/components/lite';
import {
  getLiteRemainingMs,
  isLiteAccessSnapshot,
  type LiteClockAnchor,
} from '@/components/lite/lite-clock';
import type { LiteAccessSnapshot } from '@/lib/lite-policy';

const LITE_CHANNEL_NAME = 'sapoconnect-lite-access-v1';
const LITE_TIMER_LOCK_NAME = 'sapoconnect-lite-visible-timer-v1';
const FALLBACK_DB_NAME = 'sapoconnect-lite-coordination-v1';
const FALLBACK_STORE_NAME = 'leases';
const FALLBACK_LEASE_KEY = 'visible-timer';
const FALLBACK_STORAGE_KEY = 'sapoconnect-lite-fallback-leader-v1';
const FALLBACK_LEADER_LEASE_MS = 3_000;
const FALLBACK_ELECTION_INTERVAL_MS = 500;
const FALLBACK_COORDINATION_TIMEOUT_MS = 1_000;
const HEARTBEAT_INTERVAL_MS = 1_000;
const TIMER_INTERVAL_MS = 250;
const ACTION_TIMEOUT_MS: Record<LiteUsageAction, number> = {
  start: 8_000,
  resume: 3_000,
  heartbeat: 2_000,
  pause: 1_500,
};

type LiteUsageAction = 'start' | 'resume' | 'heartbeat' | 'pause';

type LiteSnapshotResponse = {
  snapshot: LiteAccessSnapshot;
  requestElapsedMs: number;
};

export type FallbackLeaderLease = {
  owner: string;
  expiresAt: number;
};

export function resolveFallbackLeaderLease(
  current: FallbackLeaderLease | null,
  claimant: string,
  now: number
): FallbackLeaderLease {
  if (current && current.expiresAt > now && current.owner !== claimant) return current;
  return { owner: claimant, expiresAt: now + FALLBACK_LEADER_LEASE_MS };
}

export function ownsFallbackLeaderLease(
  current: FallbackLeaderLease | null,
  owner: string,
  now: number
): boolean {
  return current?.owner === owner && current.expiresAt > now;
}

export function selectFallbackCoordinationBackend(
  hasIndexedDatabase: boolean
): 'indexeddb' | 'local-storage' {
  return hasIndexedDatabase ? 'indexeddb' : 'local-storage';
}

export function shouldApplyLiteSnapshot(
  currentServerNow: number,
  incomingServerNow: number
): boolean {
  return incomingServerNow >= currentServerNow;
}

function isFallbackLeaderLease(value: unknown): value is FallbackLeaderLease {
  if (!value || typeof value !== 'object') return false;
  const lease = value as Partial<FallbackLeaderLease>;
  return (
    typeof lease.owner === 'string' &&
    lease.owner.length > 0 &&
    typeof lease.expiresAt === 'number' &&
    Number.isFinite(lease.expiresAt)
  );
}

function openFallbackDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FALLBACK_DB_NAME, 1);
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      reject(new Error('Fallback coordination database timed out'));
    }, FALLBACK_COORDINATION_TIMEOUT_MS);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(FALLBACK_STORE_NAME)) {
        request.result.createObjectStore(FALLBACK_STORE_NAME);
      }
    };
    request.onsuccess = () => {
      window.clearTimeout(timeoutId);
      if (timedOut) {
        request.result.close();
        return;
      }
      resolve(request.result);
    };
    request.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(request.error);
    };
    request.onblocked = () => {
      window.clearTimeout(timeoutId);
      reject(new Error('Fallback coordination database is blocked'));
    };
  });
}

async function mutateFallbackLease<T>(
  mutation: (
    current: FallbackLeaderLease | null,
    store: IDBObjectStore
  ) => T
): Promise<T> {
  const database = await openFallbackDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(FALLBACK_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(FALLBACK_STORE_NAME);
    const request = store.get(FALLBACK_LEASE_KEY);
    let result: T;
    const timeoutId = window.setTimeout(() => {
      try {
        transaction.abort();
      } catch {
        // A transaction that completed at the timeout boundary needs no abort.
      }
    }, FALLBACK_COORDINATION_TIMEOUT_MS);

    request.onsuccess = () => {
      const current = isFallbackLeaderLease(request.result) ? request.result : null;
      result = mutation(current, store);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {
      window.clearTimeout(timeoutId);
      database.close();
      resolve(result!);
    };
    transaction.onerror = () => {
      window.clearTimeout(timeoutId);
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      window.clearTimeout(timeoutId);
      database.close();
      reject(transaction.error ?? new Error('Fallback coordination transaction aborted'));
    };
  });
}

function readLocalFallbackLease(): FallbackLeaderLease | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FALLBACK_STORAGE_KEY) ?? 'null');
    return isFallbackLeaderLease(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function claimLocalFallbackLease(owner: string): Promise<boolean> {
  const now = Date.now();
  const next = resolveFallbackLeaderLease(readLocalFallbackLease(), owner, now);
  if (next.owner !== owner) return false;

  localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(next));
  await new Promise((resolve) => window.setTimeout(resolve, 75));
  return readLocalFallbackLease()?.owner === owner;
}

async function renewLocalFallbackLease(owner: string): Promise<boolean> {
  const now = Date.now();
  const current = readLocalFallbackLease();
  if (!ownsFallbackLeaderLease(current, owner, now)) return false;

  localStorage.setItem(
    FALLBACK_STORAGE_KEY,
    JSON.stringify({ owner, expiresAt: now + FALLBACK_LEADER_LEASE_MS })
  );
  return readLocalFallbackLease()?.owner === owner;
}

async function claimFallbackLeadership(owner: string): Promise<boolean> {
  const backend = selectFallbackCoordinationBackend('indexedDB' in window);
  if (backend === 'local-storage') return claimLocalFallbackLease(owner);
  try {
    return await mutateFallbackLease((current, store) => {
      const next = resolveFallbackLeaderLease(current, owner, Date.now());
      if (next.owner === owner) store.put(next, FALLBACK_LEASE_KEY);
      return next.owner === owner;
    });
  } catch {
    // Do not split coordination across backends after IndexedDB was selected.
    return false;
  }
}

async function renewFallbackLeadership(owner: string): Promise<boolean> {
  const backend = selectFallbackCoordinationBackend('indexedDB' in window);
  if (backend === 'local-storage') return renewLocalFallbackLease(owner);
  try {
    return await mutateFallbackLease((current, store) => {
      const now = Date.now();
      if (!ownsFallbackLeaderLease(current, owner, now)) return false;
      store.put(
        { owner, expiresAt: now + FALLBACK_LEADER_LEASE_MS },
        FALLBACK_LEASE_KEY
      );
      return true;
    });
  } catch {
    // Fail closed until the selected coordination backend recovers.
    return false;
  }
}

async function releaseFallbackLeadership(owner: string): Promise<void> {
  const backend = selectFallbackCoordinationBackend('indexedDB' in window);
  if (backend === 'indexeddb') {
    try {
      await mutateFallbackLease((current, store) => {
        if (current?.owner === owner) store.delete(FALLBACK_LEASE_KEY);
      });
    } catch {
      // The expiring lease recovers leadership if IndexedDB becomes unavailable.
    }
    return;
  }

  try {
    if (readLocalFallbackLease()?.owner === owner) {
      localStorage.removeItem(FALLBACK_STORAGE_KEY);
    }
  } catch {
    // The expiring IndexedDB lease remains authoritative.
  }
}

function pauseInitialLiteSnapshot(snapshot: LiteAccessSnapshot): LiteAccessSnapshot {
  if (snapshot.tier !== 'lite' || snapshot.state !== 'active') return snapshot;

  return {
    ...snapshot,
    expiresAt: null,
    running: false,
    leaseUntil: null,
  };
}

async function fetchLiteSnapshot(
  action: LiteUsageAction,
  keepalive = false,
  externalSignal?: AbortSignal
): Promise<LiteSnapshotResponse> {
  const requestStartedAt = performance.now();
  const controller = new AbortController();
  const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternalSignal();
  else externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });
  const timeoutId = window.setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS[action]);

  try {
    const response = await fetch('/api/lite', {
      method: 'POST',
      body: JSON.stringify({ action }),
      cache: 'no-store',
      credentials: 'same-origin',
      keepalive,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok || !isLiteAccessSnapshot(payload)) {
      throw new Error('Não foi possível confirmar seu acesso agora.');
    }

    return {
      snapshot: payload,
      requestElapsedMs: Math.max(0, performance.now() - requestStartedAt),
    };
  } catch {
    throw new Error('Não foi possível confirmar seu acesso agora.');
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

export function LiteExperienceGate({
  children,
  initialSnapshot,
}: {
  children: React.ReactNode;
  initialSnapshot: LiteAccessSnapshot;
}) {
  const [initialClientSnapshot] = useState(() => pauseInitialLiteSnapshot(initialSnapshot));
  const [snapshot, setSnapshot] = useState(initialClientSnapshot);
  const [remainingMs, setRemainingMs] = useState(
    Math.max(0, initialClientSnapshot.remainingMs)
  );
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const snapshotRef = useRef(initialClientSnapshot);
  const remainingMsRef = useRef(Math.max(0, initialClientSnapshot.remainingMs));
  const clockRef = useRef<LiteClockAnchor | null>(null);
  const leaseDeadlineRef = useRef<number | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const redirectingRef = useRef(false);
  const latestServerNowRef = useRef(initialSnapshot.serverNow);
  const snapshotTier = snapshot.tier;
  const snapshotState = snapshot.state;

  const publishSnapshot = useCallback((nextSnapshot: LiteAccessSnapshot) => {
    channelRef.current?.postMessage({ type: 'snapshot', snapshot: nextSnapshot });
  }, []);

  const redirectToLockedScreen = useCallback(
    (nextSnapshot: LiteAccessSnapshot) => {
      if (redirectingRef.current) return;
      redirectingRef.current = true;
      snapshotRef.current = nextSnapshot;
      remainingMsRef.current = 0;
      clockRef.current = null;
      leaseDeadlineRef.current = null;
      setSnapshot(nextSnapshot);
      setRemainingMs(0);
      publishSnapshot(nextSnapshot);
      window.location.replace('/lite');
    },
    [publishSnapshot]
  );

  const applySnapshot = useCallback(
    (nextSnapshot: LiteAccessSnapshot, requestElapsedMs = 0) => {
      if (!shouldApplyLiteSnapshot(latestServerNowRef.current, nextSnapshot.serverNow)) {
        return snapshotRef.current;
      }
      latestServerNowRef.current = nextSnapshot.serverNow;

      const estimatedResponseTravelMs = nextSnapshot.running ? requestElapsedMs / 2 : 0;
      const adjustedRemainingMs = Math.max(
        0,
        nextSnapshot.remainingMs - estimatedResponseTravelMs
      );
      const adjustedLeaseRemainingMs = nextSnapshot.running
        ? Math.max(
            0,
            (nextSnapshot.leaseUntil ?? nextSnapshot.serverNow) -
              nextSnapshot.serverNow -
              estimatedResponseTravelMs
          )
        : 0;
      const hasLiveLease = nextSnapshot.running && adjustedLeaseRemainingMs > 0;
      const effectiveSnapshot = {
        ...nextSnapshot,
        expiresAt: hasLiveLease ? nextSnapshot.expiresAt : null,
        remainingMs: adjustedRemainingMs,
        running: hasLiveLease,
        leaseUntil: hasLiveLease ? nextSnapshot.leaseUntil : null,
      };

      snapshotRef.current = effectiveSnapshot;
      remainingMsRef.current = adjustedRemainingMs;
      setSnapshot(effectiveSnapshot);
      setRemainingMs(adjustedRemainingMs);

      if (effectiveSnapshot.running) {
        const performanceNow = performance.now();
        clockRef.current = { remainingMs: adjustedRemainingMs, performanceNow };
        leaseDeadlineRef.current = performanceNow + adjustedLeaseRemainingMs;
      } else {
        clockRef.current = null;
        leaseDeadlineRef.current = null;
      }

      if (effectiveSnapshot.state === 'locked') {
        redirectToLockedScreen(effectiveSnapshot);
      }

      return effectiveSnapshot;
    },
    [redirectToLockedScreen]
  );

  const freezeLocalClock = useCallback((performanceAt = performance.now()) => {
    const currentSnapshot = snapshotRef.current;
    const currentClock = clockRef.current;
    const leaseDeadline = leaseDeadlineRef.current;
    const effectivePerformanceAt = leaseDeadline === null
      ? performanceAt
      : Math.min(performanceAt, leaseDeadline);
    const frozenRemainingMs = currentClock
      ? getLiteRemainingMs(currentClock, effectivePerformanceAt)
      : remainingMsRef.current;
    const locallyPausedSnapshot: LiteAccessSnapshot = {
      ...currentSnapshot,
      expiresAt: null,
      consumedMs: Math.max(
        currentSnapshot.consumedMs,
        currentSnapshot.consumedMs + currentSnapshot.remainingMs - frozenRemainingMs
      ),
      remainingMs: frozenRemainingMs,
      running: false,
      leaseUntil: null,
    };

    snapshotRef.current = locallyPausedSnapshot;
    remainingMsRef.current = frozenRemainingMs;
    clockRef.current = null;
    leaseDeadlineRef.current = null;
    setSnapshot(locallyPausedSnapshot);
    setRemainingMs(frozenRemainingMs);
  }, []);

  const runAction = useCallback(
    async (action: LiteUsageAction, keepalive = false, signal?: AbortSignal) => {
      const result = await fetchLiteSnapshot(action, keepalive, signal);
      const effectiveSnapshot = applySnapshot(result.snapshot, result.requestElapsedMs);
      publishSnapshot(effectiveSnapshot);
      return effectiveSnapshot;
    },
    [applySnapshot, publishSnapshot]
  );

  const startAccess = useCallback(async () => {
    if (isStarting) return;
    setIsStarting(true);
    setStartError(null);

    try {
      const nextSnapshot = await runAction('start');
      if (nextSnapshot.state === 'locked') return;
      if (nextSnapshot.tier !== 'lite' || nextSnapshot.state !== 'active') {
        throw new Error('Não foi possível iniciar seus 3 minutos.');
      }

      window.location.reload();
    } catch (error) {
      setStartError(
        error instanceof Error ? error.message : 'Não foi possível iniciar seus 3 minutos.'
      );
      setIsStarting(false);
    }
  }, [isStarting, runAction]);

  useEffect(() => {
    if (snapshotTier !== 'lite') return;
    if (!('BroadcastChannel' in window)) return;

    const channel = new BroadcastChannel(LITE_CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data as { type?: unknown; snapshot?: unknown } | null;
      if (message?.type !== 'snapshot' || !isLiteAccessSnapshot(message.snapshot)) return;

      const wasIntro = snapshotRef.current.state === 'intro';
      applySnapshot(message.snapshot);
      if (wasIntro && message.snapshot.state === 'active') window.location.reload();
    };

    return () => {
      channelRef.current = null;
      channel.close();
    };
  }, [applySnapshot, snapshotTier]);

  useEffect(() => {
    if (snapshotTier !== 'lite' || snapshotState !== 'active') return;

    let disposed = false;
    let shouldRun = document.visibilityState === 'visible';
    let timerId: number | null = null;
    let heartbeatId: number | null = null;
    let heartbeatPromise: Promise<void> | null = null;
    let lockWaitAbortController: AbortController | null = null;
    let leadershipAbortController: AbortController | null = null;
    let lockRequestInFlight = false;
    let isActiveLeader = false;
    let releaseLeadership: (() => void) | null = null;
    let fallbackElectionId: number | null = null;
    let fallbackRenewalId: number | null = null;
    let fallbackElectionInFlight = false;
    let fallbackRenewalInFlight = false;
    const fallbackOwner = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const stopTimer = () => {
      if (timerId === null) return;
      window.clearInterval(timerId);
      timerId = null;
    };

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      const currentSnapshot = snapshotRef.current;
      const currentClock = clockRef.current;
      const leaseDeadline = leaseDeadlineRef.current;
      if (!currentSnapshot.running || !currentClock || leaseDeadline === null) return;

      const performanceNow = performance.now();
      if (performanceNow >= leaseDeadline) {
        freezeLocalClock(leaseDeadline);
        return;
      }

      const nextRemainingMs = getLiteRemainingMs(currentClock, performanceNow);
      remainingMsRef.current = nextRemainingMs;
      setRemainingMs(nextRemainingMs);
      if (nextRemainingMs <= 0) freezeLocalClock(performanceNow);
    };

    const startTimer = () => {
      if (timerId !== null || document.visibilityState !== 'visible') return;
      tick();
      timerId = window.setInterval(tick, TIMER_INTERVAL_MS);
    };

    const heartbeat = (
      signal: AbortSignal,
      verifyLeadership?: () => Promise<boolean>
    ) => {
      if (
        heartbeatPromise ||
        !shouldRun ||
        document.visibilityState !== 'visible'
      ) {
        return;
      }

      heartbeatPromise = Promise.resolve()
        .then(async () => {
          if (verifyLeadership && !(await verifyLeadership())) return;
          await runAction('heartbeat', false, signal);
        })
        .then(() => {
          if (document.visibilityState !== 'visible') freezeLocalClock();
        })
        .catch(() => freezeLocalClock())
        .finally(() => {
          heartbeatPromise = null;
        });
    };

    const stopHeartbeat = () => {
      if (heartbeatId === null) return;
      window.clearInterval(heartbeatId);
      heartbeatId = null;
    };

    const startHeartbeat = (
      signal: AbortSignal,
      verifyLeadership?: () => Promise<boolean>
    ) => {
      if (heartbeatId !== null || !shouldRun) return;
      heartbeatId = window.setInterval(
        () => heartbeat(signal, verifyLeadership),
        HEARTBEAT_INTERVAL_MS
      );
    };

    const runLeaderSession = async (
      releaseCoordination?: () => Promise<void>,
      verifyHeartbeatLeadership?: () => Promise<boolean>,
      verifyPauseLeadership?: () => Promise<boolean>
    ) => {
      const actionController = new AbortController();
      leadershipAbortController = actionController;
      isActiveLeader = true;
      try {
        const resumed = await runAction('resume', false, actionController.signal);
        if (
          disposed ||
          !shouldRun ||
          document.visibilityState !== 'visible' ||
          resumed.state !== 'active'
        ) {
          return;
        }

        startHeartbeat(actionController.signal, verifyHeartbeatLeadership);
        await new Promise<void>((resolve) => {
          releaseLeadership = resolve;
          if (!shouldRun || disposed || actionController.signal.aborted) resolve();
        });
      } catch {
        freezeLocalClock();
      } finally {
        releaseLeadership = null;
        stopHeartbeat();
        actionController.abort();
        freezeLocalClock();
        await heartbeatPromise?.catch(() => {});
        const mayPause = verifyPauseLeadership
          ? await verifyPauseLeadership().catch(() => false)
          : true;
        if (mayPause) await runAction('pause', true).catch(() => {});
        await releaseCoordination?.().catch(() => {});
        if (leadershipAbortController === actionController) {
          leadershipAbortController = null;
        }
        isActiveLeader = false;
      }
    };

    const requestLock = () => {
      if (
        disposed ||
        !shouldRun ||
        lockRequestInFlight ||
        document.visibilityState !== 'visible' ||
        !navigator.locks
      ) {
        return;
      }

      lockRequestInFlight = true;
      lockWaitAbortController = new AbortController();
      void navigator.locks
        .request(
          LITE_TIMER_LOCK_NAME,
          { mode: 'exclusive', signal: lockWaitAbortController.signal },
          async () => {
            try {
              await runLeaderSession();
            } finally {
              leadershipAbortController?.abort();
              releaseLeadership?.();
            }
          }
        )
        .catch(() => {})
        .finally(() => {
          lockRequestInFlight = false;
          lockWaitAbortController = null;
          if (!disposed && shouldRun && document.visibilityState === 'visible') {
            window.setTimeout(requestLock, HEARTBEAT_INTERVAL_MS);
          }
        });
    };

    const stopFallbackRenewal = () => {
      if (fallbackRenewalId === null) return;
      window.clearInterval(fallbackRenewalId);
      fallbackRenewalId = null;
    };

    const runFallbackLeader = async () => {
      const releaseCoordination = async () => {
        stopFallbackRenewal();
        await releaseFallbackLeadership(fallbackOwner);
      };

      fallbackRenewalId = window.setInterval(() => {
        if (fallbackRenewalInFlight) return;
        fallbackRenewalInFlight = true;
        void renewFallbackLeadership(fallbackOwner)
          .then((retained) => {
            if (!retained) {
              leadershipAbortController?.abort();
              releaseLeadership?.();
            }
          })
          .catch(() => {
            leadershipAbortController?.abort();
            releaseLeadership?.();
          })
          .finally(() => {
            fallbackRenewalInFlight = false;
          });
      }, HEARTBEAT_INTERVAL_MS);

      const verifyHeartbeatLeadership = async () => {
        const retained = await renewFallbackLeadership(fallbackOwner);
        if (!retained) {
          leadershipAbortController?.abort();
          releaseLeadership?.();
        }
        return retained;
      };

      await runLeaderSession(
        releaseCoordination,
        verifyHeartbeatLeadership,
        verifyHeartbeatLeadership
      );
    };

    const tryFallbackElection = async () => {
      if (
        fallbackElectionInFlight ||
        isActiveLeader ||
        disposed ||
        !shouldRun ||
        document.visibilityState !== 'visible'
      ) {
        return;
      }

      fallbackElectionInFlight = true;
      try {
        const acquired = await claimFallbackLeadership(fallbackOwner);
        if (!acquired) return;
        if (disposed || !shouldRun || document.visibilityState !== 'visible') {
          await releaseFallbackLeadership(fallbackOwner);
          return;
        }
        await runFallbackLeader();
      } catch {
        freezeLocalClock();
      } finally {
        fallbackElectionInFlight = false;
      }
    };

    const startFallbackElection = () => {
      if (fallbackElectionId !== null) return;
      void tryFallbackElection();
      fallbackElectionId = window.setInterval(
        () => void tryFallbackElection(),
        FALLBACK_ELECTION_INTERVAL_MS
      );
    };

    const stopFallbackElection = () => {
      if (fallbackElectionId !== null) {
        window.clearInterval(fallbackElectionId);
        fallbackElectionId = null;
      }
      leadershipAbortController?.abort();
      releaseLeadership?.();
    };

    const activate = () => {
      shouldRun = true;
      startTimer();
      if (navigator.locks) requestLock();
      else startFallbackElection();
    };

    const deactivate = () => {
      if (!shouldRun && document.visibilityState !== 'visible') return;
      shouldRun = false;
      stopTimer();
      freezeLocalClock();

      if (navigator.locks) {
        lockWaitAbortController?.abort();
        leadershipAbortController?.abort();
        releaseLeadership?.();
      } else {
        stopFallbackElection();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        freezeLocalClock();
        activate();
      }
      else deactivate();
    };
    const handlePageShow = () => {
      if (document.visibilityState === 'visible') {
        freezeLocalClock();
        activate();
      }
    };
    const handlePageHide = () => deactivate();
    const handleOnline = () => {
      if (document.visibilityState !== 'visible') return;
      if (navigator.locks) {
        if (isActiveLeader && leadershipAbortController) {
          heartbeat(leadershipAbortController.signal);
        }
        else requestLock();
      }
      else startFallbackElection();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('online', handleOnline);
    if (shouldRun) activate();

    return () => {
      disposed = true;
      shouldRun = false;
      stopTimer();
      stopHeartbeat();
      freezeLocalClock();
      lockWaitAbortController?.abort();
      leadershipAbortController?.abort();
      releaseLeadership?.();
      stopFallbackElection();
      stopFallbackRenewal();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('online', handleOnline);
    };
  }, [freezeLocalClock, runAction, snapshotState, snapshotTier]);

  if (snapshotTier === 'full' || snapshotState === 'full') return children;

  if (snapshotState === 'intro') {
    return (
      <LiteIntroNotice
        error={startError}
        isStarting={isStarting}
        onStart={() => void startAccess()}
      />
    );
  }

  if (snapshotState === 'locked') return <LiteLockedScreen snapshot={snapshot} />;

  if (!snapshot.running) return <LiteResumeScreen remainingMs={remainingMs} />;

  return (
    <div className="contents" data-sapoconnect-lite="active">
      {children}
      <LiteWatermark remainingMs={remainingMs} isRunning={snapshot.running} />
    </div>
  );
}
