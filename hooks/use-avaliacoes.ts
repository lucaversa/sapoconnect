'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch, SessionExpiredError } from '@/lib/fetch-client';
import { parseApiError, isSessionExpiredApiError } from '@/lib/api-response-error';
import { queryKeys } from '@/lib/query-keys';

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
  somativaGeralPorcentagem?: number;
  mediaParaAprovacao: number;
}

export interface AvaliacoesResponse {
  disciplinas?: DisciplinaOpcao[];
}

export function useAvaliacoes() {
  return useQuery({
    queryKey: queryKeys.avaliacoes(),
    queryFn: async () => {
      const response = await apiFetch('/api/avaliacoes');
      if (!response.ok) {
        const apiError = await parseApiError(response);
        if (isSessionExpiredApiError(apiError)) {
          throw new SessionExpiredError();
        }
        throw apiError;
      }
      return response.json() as Promise<AvaliacoesResponse>;
    },
  });
}

export function useAvaliacoesNotas(codigo: string) {
  return useQuery({
    queryKey: queryKeys.avaliacoesNotas(codigo),
    queryFn: async () => {
      const response = await apiFetch('/api/avaliacoes/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });

      if (!response.ok) {
        const apiError = await parseApiError(response);
        if (isSessionExpiredApiError(apiError)) {
          throw new SessionExpiredError();
        }
        throw apiError;
      }

      return response.json() as Promise<ResultadoAvaliacoes>;
    },
    enabled: !!codigo,
  });
}
