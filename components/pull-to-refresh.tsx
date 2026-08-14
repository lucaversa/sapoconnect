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

export function PullToRefresh({ minPullDistance = 70, onRefresh }: PullToRefreshProps) {
  const queryClient = useQueryClient();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
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

    const detectionTimer = window.setTimeout(() => setIsTouchDevice(true), 0);

    const getScrollTop = () => {
      const scrollingElement = document.scrollingElement;
      if (scrollingElement) return scrollingElement.scrollTop;
      return document.documentElement.scrollTop || document.body.scrollTop || 0;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (refreshingRef.current) return;
      if (event.touches.length !== 1) return;
      if (getScrollTop() > 0) return;
      startYRef.current = event.touches[0].clientY;
      startXRef.current = event.touches[0].clientX;
      isPullingRef.current = true;
      readyRef.current = false;
      setPullDistance(0);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!isPullingRef.current || refreshingRef.current) return;
      if (event.touches.length !== 1) return;
      const currentY = event.touches[0].clientY;
      const currentX = event.touches[0].clientX;
      const deltaY = currentY - startYRef.current;
      const deltaX = currentX - startXRef.current;

      if (Math.abs(deltaX) > Math.abs(deltaY)) return;
      if (deltaY <= 0) {
        setPullDistance(0);
        return;
      }

      if (getScrollTop() > 0) {
        isPullingRef.current = false;
        setPullDistance(0);
        return;
      }

      event.preventDefault();
      const distance = Math.min(deltaY, minPullDistance + 40);
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

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.clearTimeout(detectionTimer);
    };
  }, [minPullDistance, onRefresh, queryClient]);

  const isPullVisible = pullDistance > 0 || isRefreshing;
  const isReady = pullDistance >= minPullDistance;
  const message = isRefreshing
    ? 'Atualizando...'
    : isReady
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
          <div className="liquid-panel flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-[11px] font-semibold text-gray-700 shadow-[0_14px_32px_-18px_rgba(15,23,42,0.6)] dark:text-gray-200">
            <RefreshCw
              className={`size-3.5 shrink-0 text-primary ${isRefreshing ? 'animate-spin' : ''}`}
              style={reducedMotion || isRefreshing ? undefined : { transform: `rotate(${Math.min(pullDistance * 2.4, 180)}deg)` }}
              aria-hidden="true"
            />
            <span>{message}</span>
          </div>
        </motion.div>
      ) : null}
      {isTouchDevice && !isPullVisible ? (
        <motion.div
          key="pull-hint"
          initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 sm:hidden"
          role="status"
        >
          <div className="liquid-panel flex max-w-full items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-semibold text-gray-700 shadow-[0_14px_32px_-18px_rgba(15,23,42,0.6)] dark:text-gray-200">
            <RefreshCw className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">Puxe para baixo para atualizar</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
