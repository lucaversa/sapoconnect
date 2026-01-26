'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { XCircle, AlertCircle } from 'lucide-react';

interface Toast {
  id: string;
  type: 'error' | 'warning';
  title: string;
  message: string;
}

interface ToastContextType {
  showToast: (type: 'error' | 'warning', title: string, message: string) => void;
  showEduConnectError: () => void;
  showNoDataError: (pagina: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: 'error' | 'warning', title: string, message: string) => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, type, title, message };
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 8000);
  }, []);

  const showEduConnectError = useCallback(() => {
    showToast(
      'error',
      'Problema ao conectar com EduConnect',
      'O sistema da faculdade pode estar fora do ar. Tente recarregar a página em alguns instantes.'
    );
  }, [showToast]);

  const showNoDataError = useCallback((pagina: string) => {
    showToast(
      'warning',
      `Nenhum dado encontrado em ${pagina}`,
      'Isso pode acontecer quando não há informações disponíveis no EduConnect. Clique em atualizar para tentar novamente.'
    );
  }, [showToast]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showEduConnectError, showNoDataError }}>
      {children}
      <div className="fixed top-20 left-0 right-0 z-[100] px-4 sm:left-auto sm:right-4 sm:px-0 flex flex-col items-center sm:items-end gap-2 max-w-sm w-full sm:w-auto pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`
              flex items-start gap-3 p-4 rounded-xl shadow-lg border animate-in slide-in-from-top-4 duration-300 pointer-events-auto w-full
              ${toast.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/90 border-red-200 dark:border-red-900/50'
                : 'bg-amber-50 dark:bg-amber-950/90 border-amber-200 dark:border-amber-900/50'
              }
            `}
          >
            <div className={`shrink-0 ${toast.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {toast.type === 'error' ? <XCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${toast.type === 'error' ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'}`}>
                {toast.title}
              </p>
              <p className={`text-xs mt-1 ${toast.type === 'error' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className={`shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 ${toast.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
