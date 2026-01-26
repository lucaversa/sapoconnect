'use client';

import { XCircle, AlertCircle, WifiOff, FileSearch, LogIn, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isSessionExpiredError } from '@/lib/fetch-client';
import { ApiResponseError } from '@/lib/api-response-error';

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
      <div className="text-center max-w-md">
        <Icon
          className={`w-12 h-12 mx-auto mb-4 ${
            detectedType === 'session' ? 'text-amber-500' : 'text-red-500'
          }`}
        />
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          {config.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {message || config.message}
        </p>

        {detectedType === 'session' ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleLogin}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors w-full sm:w-auto"
            >
              <LogIn className="w-4 h-4" />
              Fazer login
            </button>
            {retry && (
              <button
                onClick={retry}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm font-medium transition-colors w-full sm:w-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </button>
            )}
          </div>
        ) : retry ? (
          <button
            onClick={retry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        ) : null}
      </div>
    </div>
  );
}
