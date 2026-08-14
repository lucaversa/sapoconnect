'use client';

import { useApiQuery } from './use-api-query';
import { queryKeys } from '@/lib/query-keys';
import { QUERY_STALE_TIME } from '@/lib/query-policy';

export interface FaltasItem {
  codigo: string;
  disciplina: string;
  turma: string;
  situacao: string;
  limiteFaltas: string;
  porcentagem: string;
  porcentagemValor: number;
  status: 'abaixo' | 'proximo' | 'acima';
  ch?: string;
  umaFaltaPct?: string;
  aulasTotal?: number;
  aulasRealizadas?: number;
  diasRestantes?: number;
  eventosFuturos?: string[];
}

export interface FaltasResponse {
  faltas?: FaltasItem[];
  __cacheStale?: boolean;
}

export function useFaltas() {
  return useApiQuery<FaltasResponse>(
    queryKeys.faltas(),
    '/api/faltas/completo',
    { staleTime: QUERY_STALE_TIME.faltas }
  );
}
