import { useQuery } from '@tanstack/react-query';
import { apiFetch, SessionExpiredError } from '@/lib/fetch-client';
import { parseApiError, isSessionExpiredApiError } from '@/lib/api-response-error';
import { QUERY_STALE_TIME } from '@/lib/query-policy';

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
    retry: false,
    refetchOnMount: true,
    staleTime: QUERY_STALE_TIME.detalheAula,
  });
}
