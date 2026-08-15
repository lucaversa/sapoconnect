'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';

interface PullToRefreshProps {
  minPullDistance?: number;
  onRefresh?: () => Promise<void> | void;
}

const PULL_HINT_SEEN_KEY = 'sapoconnect_pull_hint_seen_v1';
const PULL_HINT_DELAY_MS = 700;
const PULL_HINT_DURATION_MS = 4_000;
const DEFAULT_PULL_DISTANCE = 96;
const PULL_ACTIVATION_DISTANCE = 18;
const PULL_RESISTANCE = 0.72;
const VERTICAL_INTENT_RATIO = 1.35;
let pullHintShownInMemory = false;

export function PullToRefresh({ minPullDistance = DEFAULT_PULL_DISTANCE, onRefresh }: PullToRefreshProps) {
  const queryClient = useQueryClient();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPullHint, setShowPullHint] = useState(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isPullingRef = useRef(false);
  const readyRef = useRef(false);
  const refreshingRef = useRef(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    if (!hasTouch) return;

    let hintTimer: number | null = null;
    let hideHintTimer: number | null = null;
    const detectionTimer = window.setTimeout(() => {
      if (pullHintShownInMemory) return;

      try {
        if (window.localStorage.getItem(PULL_HINT_SEEN_KEY)) return;
        window.localStorage.setItem(PULL_HINT_SEEN_KEY, '1');
      } catch {
        // The in-memory guard still prevents repetition during this session.
      }

      pullHintShownInMemory = true;
      hintTimer = window.setTimeout(() => setShowPullHint(true), PULL_HINT_DELAY_MS);
      hideHintTimer = window.setTimeout(
        () => setShowPullHint(false),
        PULL_HINT_DELAY_MS + PULL_HINT_DURATION_MS,
      );
    }, 0);

    const getScrollTop = () => {
      const scrollingElement = document.scrollingElement;
      if (scrollingElement) return scrollingElement.scrollTop;
      return document.documentElement.scrollTop || document.body.scrollTop || 0;
    };

    const resetPullGesture = () => {
      isPullingRef.current = false;
      readyRef.current = false;
      setPullDistance(0);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (refreshingRef.current) return;
      if (event.touches.length !== 1) return;
      if (getScrollTop() > 0) return;
      if (event.target instanceof Element && event.target.closest('[data-calendar-scroll]')) return;
      startYRef.current = event.touches[0].clientY;
      startXRef.current = event.touches[0].clientX;
      isPullingRef.current = true;
      readyRef.current = false;
      setPullDistance(0);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!isPullingRef.current || refreshingRef.current) return;
      if (event.touches.length !== 1) {
        resetPullGesture();
        return;
      }
      const currentY = event.touches[0].clientY;
      const currentX = event.touches[0].clientX;
      const deltaY = currentY - startYRef.current;
      const deltaX = currentX - startXRef.current;
      const absoluteDeltaX = Math.abs(deltaX);

      if (deltaY <= 0) {
        resetPullGesture();
        return;
      }

      if (deltaY < PULL_ACTIVATION_DISTANCE) return;

      if (absoluteDeltaX > 10 && deltaY < absoluteDeltaX * VERTICAL_INTENT_RATIO) {
        resetPullGesture();
        return;
      }

      if (getScrollTop() > 0) {
        resetPullGesture();
        return;
      }

      event.preventDefault();
      const resistedDistance = (deltaY - PULL_ACTIVATION_DISTANCE) * PULL_RESISTANCE;
      const distance = Math.min(resistedDistance, minPullDistance + 40);
      setPullDistance(distance);
      readyRef.current = distance >= minPullDistance;
    };

    const onTouchEnd = async () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;

      if (readyRef.current && !refreshingRef.current) {
        refreshingRef.current = true;
        setIsRefreshing(true);
        setPullDistance(minPullDistance);

        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            const toastId = toast.loading('Atualizando...');
            try {
              await queryClient.refetchQueries({ type: 'active' });
              toast.success('Atualizado com sucesso!', { id: toastId });
            } catch {
              toast.error('Erro ao atualizar. Tente novamente.', { id: toastId });
            }
          }
        } catch {
          // onRefresh already handles errors/toasts
        } finally {
          refreshingRef.current = false;
          setIsRefreshing(false);
        }
      }

      readyRef.current = false;
      setPullDistance(0);
    };

    const onTouchCancel = () => {
      resetPullGesture();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchCancel);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
      window.clearTimeout(detectionTimer);
      if (hintTimer) window.clearTimeout(hintTimer);
      if (hideHintTimer) window.clearTimeout(hideHintTimer);
    };
  }, [minPullDistance, onRefresh, queryClient]);

  // The page refresh callback owns the loading toast. Keep this indicator only
  // for the drag gesture so users never see two simultaneous progress notices.
  const isPullVisible = pullDistance > 0 && !isRefreshing;
  const isReady = pullDistance >= minPullDistance;
  const message = isReady
    ? 'Solte para atualizar'
    : pullDistance > 0
      ? 'Puxe mais um pouco'
      : 'Puxe para baixo para atualizar';
  const translateY = pullDistance > 0 ? Math.min(pullDistance * 0.3, 22) : 0;

  return (
    <AnimatePresence>
      {isPullVisible ? (
        <motion.div
          key="pull-progress"
          initial={reducedMotion ? false : { opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: translateY, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed left-1/2 top-[calc(4.75rem+env(safe-area-inset-top))] z-40 -translate-x-1/2 lg:hidden"
          role="status"
          aria-live="polite"
        >
          <div className="liquid-float liquid-notice flex items-center gap-2.5 whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-semibold text-gray-700 dark:text-gray-100">
            <span className="liquid-notice-icon size-7 rounded-full text-primary">
              <RefreshCw
                className="size-3.5 shrink-0"
                style={reducedMotion ? undefined : { transform: `rotate(${Math.min(pullDistance * 2.4, 180)}deg)` }}
                aria-hidden="true"
              />
            </span>
            <span>{message}</span>
          </div>
        </motion.div>
      ) : null}
      {showPullHint && !isPullVisible ? (
        <motion.div
          key="pull-hint"
          initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 sm:hidden"
          role="status"
        >
          <div className="liquid-float liquid-notice flex max-w-full items-center gap-2.5 rounded-full px-3 py-2 text-[11px] font-semibold text-gray-700 dark:text-gray-100">
            <span className="liquid-notice-icon size-7 rounded-full text-primary">
              <RefreshCw className="size-3.5 shrink-0" aria-hidden="true" />
            </span>
            <span className="truncate">Puxe para baixo para atualizar</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
