'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch, SessionExpiredError } from '@/lib/fetch-client';
import { parseApiError, isSessionExpiredApiError } from '@/lib/api-response-error';
import { queryKeys } from '@/lib/query-keys';
import { QUERY_STALE_TIME } from '@/lib/query-policy';

export interface DisciplinaOpcao {
  codigo: string;
  nome: string;
}

export interface Avaliacao {
  nome: string;
  data?: string;
  nota?: string;
  valor?: string;
}

export interface CategoriaComAvaliacoes {
  nome: string;
  avaliacoes: Avaliacao[];
  notaTotal?: number;
  valorTotal?: number;
  porcentagem?: number;
}

export interface ResultadoAvaliacoes {
  categorias: CategoriaComAvaliacoes[];
  somativaGeral?: number;
  mediaParaAprovacao: number;
}

export interface DisciplinaComAvaliacoes extends DisciplinaOpcao {
  resultado?: ResultadoAvaliacoes;
  error?: string;
  code?: string;
}

export interface AvaliacoesCompletoResponse {
  disciplinas?: DisciplinaComAvaliacoes[];
  __cacheStale?: boolean;
}

export function useAvaliacoesCompleto() {
  return useQuery({
    queryKey: queryKeys.avaliacoesCompleto(),
    queryFn: async () => {
      const response = await apiFetch('/api/avaliacoes/completo');
      if (!response.ok) {
        const apiError = await parseApiError(response);
        if (isSessionExpiredApiError(apiError)) {
          throw new SessionExpiredError();
        }
        throw apiError;
      }
      const data = await response.json() as AvaliacoesCompletoResponse;
      if (response.headers.get('x-sapoconnect-cache') === 'stale') data.__cacheStale = true;
      return data;
    },
    staleTime: QUERY_STALE_TIME.avaliacoes,
  });
}
