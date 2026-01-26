'use client';

import { useApiQuery } from './use-api-query';
import { queryKeys } from '@/lib/query-keys';

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
}

export function useHistorico() {
  return useApiQuery<HistoricoResponse>(
    queryKeys.historico(),
    '/api/historico'
  );
}
