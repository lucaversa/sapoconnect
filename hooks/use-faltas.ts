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

export interface DataFalta {
  data: string;
  label: string;
}

export interface DatasFaltaResponse {
  codigo: string;
  datasFalta: DataFalta[];
  datasFaltaStatus: 'ok' | 'sem_dados';
  fonte: 'revisao_frequencia';
  escopo: 'disponiveis_para_revisao';
  __cacheStale?: boolean;
}

export function useFaltas() {
  return useApiQuery<FaltasResponse>(
    queryKeys.faltas(),
    '/api/faltas/completo',
    { staleTime: QUERY_STALE_TIME.faltas }
  );
}

export function useDatasFalta(codigo: string, enabled: boolean) {
  return useApiQuery<DatasFaltaResponse>(
    queryKeys.faltasDatas(codigo),
    `/api/faltas/datas?codigo=${encodeURIComponent(codigo)}`,
    { enabled, staleTime: QUERY_STALE_TIME.faltas }
  );
}
