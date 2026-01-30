'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface PullToRefreshProps {
  minPullDistance?: number;
  onRefresh?: () => Promise<void> | void;
}

export function PullToRefresh({ minPullDistance = 70, onRefresh }: PullToRefreshProps) {
  const queryClient = useQueryClient();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isPullingRef = useRef(false);
  const readyRef = useRef(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (navigator.maxTouchPoints === 0 && !('ontouchstart' in window)) return;

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
    };
  }, [minPullDistance, queryClient]);

  const isVisible = pullDistance > 0 || isRefreshing;
  const translateY = Math.min(pullDistance, minPullDistance);

  return (
    <div
      className="pointer-events-none fixed top-2 left-1/2 z-50 -translate-x-1/2"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: `translate(-50%, ${translateY}px)`,
        transition: isRefreshing ? 'opacity 0.2s ease' : 'opacity 0.2s ease, transform 0.2s ease',
      }}
    >
      <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm backdrop-blur dark:bg-gray-900/80 dark:text-gray-200">
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        <span>{isRefreshing ? 'Atualizando...' : 'Puxe para atualizar'}</span>
      </div>
    </div>
  );
}
