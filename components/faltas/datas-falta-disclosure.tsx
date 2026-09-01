'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import { useDatasFalta } from '@/hooks/use-faltas';

function apiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;

  const candidate = error as { message?: unknown; status?: unknown };
  return typeof candidate.status === 'number' && typeof candidate.message === 'string'
    ? candidate.message
    : null;
}

function weekdayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';

  const label = format(date, 'EEEE', { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DatasFaltaSection({
  codigo,
}: {
  codigo: string;
}) {
  const {
    data,
    error,
    isPending,
    isFetching,
    fetchStatus,
    refetch,
  } = useDatasFalta(codigo, true);
  const sectionTitleId = `datas-falta-${codigo.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const count = data?.datasFalta.length;
  const errorMessage = apiErrorMessage(error)
    ?? 'Não foi possível consultar os dias de falta desta disciplina.';

  return (
    <section
      data-absence-history
      aria-labelledby={sectionTitleId}
      className="py-4 sm:py-5"
    >
      <div className="rounded-2xl bg-gray-950/[0.025] p-3.5 dark:bg-white/[0.025] sm:p-4">
        <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <h4 id={sectionTitleId} className="text-sm font-bold text-gray-950 dark:text-white">
            Faltas disponíveis para revisão
          </h4>
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            Apenas datas que a TOTVS permite revisar neste momento
          </span>
        </span>
        {typeof count === 'number' ? (
          <span className="shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold tabular-nums text-gray-600 dark:bg-white/[0.055] dark:text-gray-300">
            {count} {count === 1 ? 'dia' : 'dias'}
          </span>
        ) : null}
        {isFetching && !isPending ? (
          <LoaderCircle
            className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        </div>

        <div
          className="mt-3 border-t border-gray-200/65 pt-3 dark:border-white/[0.055]"
          aria-live="polite"
          aria-busy={isFetching}
        >
          {isPending && fetchStatus === 'paused' ? (
            <div className="flex items-start gap-2 text-xs leading-5 text-amber-700 dark:text-amber-300" role="status">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Conecte-se para consultar estas datas.
            </div>
          ) : isPending ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400" role="status">
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Consultando datas na TOTVS...
            </div>
          ) : error && !data ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-xs leading-5 text-red-700 dark:text-red-300">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => void refetch()}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 motion-reduce:transition-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Tentar novamente
              </button>
            </div>
          ) : data?.datasFaltaStatus === 'sem_dados' ? (
            <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
              Nenhuma falta está disponível para revisão nesta consulta.
            </p>
          ) : data ? (
            <ol
              className="grid grid-cols-1 gap-x-6 sm:grid-cols-2"
              aria-label="Faltas disponíveis para revisão informadas pela TOTVS"
            >
              {data.datasFalta.map((item) => (
                <li
                  key={item.data}
                  className="flex min-h-12 items-center justify-between gap-3 border-b border-gray-200/65 py-2.5 last:border-b-0 dark:border-white/[0.055] sm:[&:nth-last-child(-n+2)]:border-b-0"
                >
                  <time
                    dateTime={item.data}
                    className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white"
                  >
                    {item.label}
                  </time>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {weekdayLabel(item.data)}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          {error && data ? (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              Não foi possível atualizar agora. Exibindo a última consulta salva.
            </p>
          ) : data?.__cacheStale ? (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              Exibindo a última consulta salva.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
