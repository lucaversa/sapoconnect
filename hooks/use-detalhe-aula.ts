import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { apiFetch, SessionExpiredError } from '@/lib/fetch-client';
import { parseApiError, isSessionExpiredApiError } from '@/lib/api-response-error';

export interface DetalheAula {
  horario?: string;
  codigo_disciplina?: string;
  nome_disciplina?: string;
  data_inicial?: string;
  data_final?: string;
  turma?: string;
  subturma?: string;
  tipo_turma?: string;
  professores: string[];
  predio?: string;
  bloco?: string;
  sala?: string;
}

type DetalheAulaResponse = DetalheAula;
const DETALHE_STALE_TIME_MS = 10 * 60 * 1000;
const EMPTY_PROFESSOR_STALE_TIME_MS = 0;

export function useDetalheAula(id: string | null) {
  return useQuery<DetalheAulaResponse>({
    queryKey: id ? ['aula-detalhe', id] : ['aula-detalhe', null],
    queryFn: async () => {
      if (!id) throw new Error('ID da aula é obrigatório');

      const response = await apiFetch(`/api/calendario/detalhe?id=${encodeURIComponent(id)}`);
      if (!response.ok) {
        const apiError = await parseApiError(response);
        if (isSessionExpiredApiError(apiError)) {
          throw new SessionExpiredError();
        }
        throw apiError;
      }
      return response.json();
    },
    enabled: !!id,
    staleTime: (query) => {
      const cached = query.state.data as DetalheAulaResponse | undefined;
      if (!cached) return EMPTY_PROFESSOR_STALE_TIME_MS;
      return cached.professores.length > 0
        ? DETALHE_STALE_TIME_MS
        : EMPTY_PROFESSOR_STALE_TIME_MS;
    },
  });
}
