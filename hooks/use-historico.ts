'use client';

import { useApiQuery } from './use-api-query';
import { queryKeys } from '@/lib/query-keys';
import { QUERY_STALE_TIME } from '@/lib/query-policy';

export interface Disciplina {
  nome: string;
  codigo: string;
  creditos: string;
  ch: string;
  chIntegralizada: string;
  situacao: string;
  conceito?: string;
  nota?: string;
  faltas?: string;
  periodo?: string;
  status: 'concluida' | 'pendente' | 'naoconcluida' | 'equivalente';
}

export interface Periodo {
  nome: string;
  totalCH: string;
  disciplinas: Disciplina[];
}

export interface HistoricoResponse {
  periodos?: Periodo[];
  __cacheStale?: boolean;
}

export function useHistorico() {
  return useApiQuery<HistoricoResponse>(
    queryKeys.historico(),
    '/api/historico',
    { staleTime: QUERY_STALE_TIME.historico }
  );
}
