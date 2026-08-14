'use client';

import { CheckCircle2, CircleAlert, Info, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Toaster } from 'sonner';

import { useTheme } from '@/context/ThemeContext';

export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme}
      position="top-center"
      style={{ zIndex: 35 }}
      visibleToasts={3}
      gap={10}
      offset={{ top: 'calc(env(safe-area-inset-top) + 4.75rem)' }}
      mobileOffset={{
        top: 'calc(env(safe-area-inset-top) + 4.75rem)',
        left: '1rem',
        right: '1rem',
      }}
      swipeDirections={['left', 'right', 'top']}
      icons={{
        success: <CheckCircle2 className="size-4" aria-hidden="true" />,
        error: <CircleAlert className="size-4" aria-hidden="true" />,
        warning: <TriangleAlert className="size-4" aria-hidden="true" />,
        info: <Info className="size-4" aria-hidden="true" />,
        loading: <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'liquid-float liquid-toast',
          content: 'liquid-toast-content',
          title: 'liquid-toast-title',
          description: 'liquid-toast-description',
          icon: 'liquid-toast-icon',
          success: 'liquid-toast-success',
          error: 'liquid-toast-error',
          warning: 'liquid-toast-warning',
          info: 'liquid-toast-info',
          loading: 'liquid-toast-loading',
        },
      }}
    />
  );
}
