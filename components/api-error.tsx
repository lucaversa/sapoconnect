'use client';

import { XCircle, AlertCircle, WifiOff, FileSearch, LogIn, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isSessionExpiredError } from '@/lib/fetch-client';
import { ApiResponseError } from '@/lib/api-response-error';
import { Button } from '@/components/ui/button';

type ErrorType = 'network' | 'session' | 'server' | 'notFound' | 'offline';

// Detecta automaticamente o tipo de erro baseado na instncia/mensagem
export function getErrorType(error: unknown): ErrorType {
  if (isSessionExpiredError(error)) return 'session';
  if (error instanceof ApiResponseError) {
    if (error.code === 'TOTVS_OFFLINE') return 'offline';
    if (error.code === 'SESSION_EXPIRED' || error.code === 'SESSION_MISSING') return 'session';
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('sessão') || msg.includes('sessão expirada') || msg.includes('login')) return 'session';
    if (msg.includes('network') || msg.includes('conexão') || msg.includes('fetch')) return 'network';
  }
  return 'server';
}

const ERROR_CONFIG = {
  network: {
    icon: WifiOff,
    title: 'Erro de conexão',
    message: 'Não foi possível conectar ao servidor.',
  },
  session: {
    icon: AlertCircle,
    title: 'Sessão expirada',
    message: 'Sua sessão expirou. Faça login novamente para continuar.',
  },
  server: {
    icon: XCircle,
    title: 'Erro no servidor',
    message: 'O servidor está temporariamente indisponível.',
  },
  offline: {
    icon: WifiOff,
    title: 'TOTVS indisponível',
    message: 'Sistema da TOTVS possivelmente fora do ar. Tente novamente mais tarde.',
  },
  notFound: {
    icon: FileSearch,
    title: 'Dados não encontrados',
    message: 'Nenhum dado disponível.',
  },
} as const;

interface ApiErrorProps {
  type?: ErrorType;
  error?: unknown;
  message?: string;
  retry?: () => void;
}

export function ApiError({ type, error, message, retry }: ApiErrorProps) {
  const detectedType = type || getErrorType(error);
  const config = ERROR_CONFIG[detectedType];
  const Icon = config.icon;
  const router = useRouter();

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <div className="flex items-center justify-center p-8">
      <div className="academic-panel w-full max-w-md p-6 text-center sm:p-8">
        <span className="icon-orb mx-auto mb-4 size-16"><Icon
          className={`size-7 ${
            detectedType === 'session' ? 'text-amber-500' : 'text-red-500'
          }`}
        /></span>
        <h3 className="mb-2 text-lg font-extrabold tracking-[-0.03em] text-gray-900 dark:text-white">
          {config.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {message || config.message}
        </p>

        {detectedType === 'session' ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={handleLogin} className="w-full gap-2 sm:w-auto">
              <LogIn className="w-4 h-4" />
              Fazer login
            </Button>
            {retry && (
              <Button variant="outline" onClick={retry} className="w-full gap-2 sm:w-auto">
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </Button>
            )}
          </div>
        ) : retry ? (
          <Button onClick={retry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </Button>
        ) : null}
      </div>
    </div>
  );
}
