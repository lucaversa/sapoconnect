'use client';

import { useApiQuery } from './use-api-query';
import { queryKeys } from '@/lib/query-keys';
import { HorarioResponse } from '@/types/calendario';
import { QUERY_STALE_TIME } from '@/lib/query-policy';

export function useHorario() {
  return useApiQuery<HorarioResponse>(
    queryKeys.calendario(),
    '/api/calendario/horario',
    { staleTime: QUERY_STALE_TIME.calendario }
  );
}
