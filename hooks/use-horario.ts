'use client';

import { useApiQuery } from './use-api-query';
import { queryKeys } from '@/lib/query-keys';
import { HorarioResponse } from '@/types/calendario';

export function useHorario() {
  return useApiQuery<HorarioResponse>(
    queryKeys.calendario(),
    '/api/calendario/horario'
  );
}
