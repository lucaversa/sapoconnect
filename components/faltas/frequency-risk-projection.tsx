import { format } from 'date-fns';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle,
} from 'lucide-react';

export interface FrequencyProjectionPoint {
  key: string;
  date: Date;
  removed: boolean;
  totalPercent: number;
  aboveLimit: boolean;
}

interface FrequencyRiskProjectionProps {
  id: string;
  discipline: string;
  limitLabel: string;
  points: FrequencyProjectionPoint[];
}

function formatPercent(value: number): string {
  const formatted = value.toFixed(1).replace('.', ',');
  return `${formatted.replace(/,0$/, '')}%`;
}

function markerClass(point: FrequencyProjectionPoint): string {
  if (point.removed) {
    return 'border-gray-400 bg-gray-100 ring-gray-400/10 dark:border-gray-500 dark:bg-gray-800';
  }

  return point.aboveLimit
    ? 'border-red-500 bg-red-500 ring-red-500/15'
    : 'border-primary bg-primary ring-primary/10';
}

function textClass(point: FrequencyProjectionPoint): string {
  if (point.removed) return 'text-gray-400 dark:text-gray-500';
  return point.aboveLimit
    ? 'text-red-700 dark:text-red-300'
    : 'text-gray-700 dark:text-gray-300';
}

export function FrequencyRiskProjection({
  id,
  discipline,
  limitLabel,
  points,
}: FrequencyRiskProjectionProps) {
  if (points.length === 0) return null;

  const firstRisk = points.find((point) => point.aboveLimit && !point.removed);
  const lastActivePoint = [...points].reverse().find((point) => !point.removed);

  return (
    <figure data-risk-projection aria-labelledby={id} className="mt-4 border-t border-primary/15 pt-4 dark:border-white/[0.07]">
      <figcaption className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <h5 id={id} className="text-sm font-bold text-gray-950 dark:text-white">
              Projeção por data
            </h5>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
            Percentual acumulado ao faltar nas aulas incluídas
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-primary/15 bg-white/55 px-2 py-1 text-xs font-semibold tabular-nums text-gray-600 dark:border-white/[0.075] dark:bg-gray-950/20 dark:text-gray-300">
          Limite {limitLabel}
        </span>
      </figcaption>

      {firstRisk ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-red-500/[0.06] px-3 py-2.5" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-300" aria-hidden="true" />
          <p className="min-w-0 text-xs leading-5 text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-red-800 dark:text-red-200">
              Limite ultrapassado em{' '}
              <time dateTime={format(firstRisk.date, 'yyyy-MM-dd')}>
                {format(firstRisk.date, 'dd/MM')}
              </time>.
            </span>{' '}
            Projeção de {formatPercent(firstRisk.totalPercent)}.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-primary/[0.06] px-3 py-2.5" role="status">
          <CheckCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0 text-xs leading-5 text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">
              Dentro do limite nas aulas simuladas.
            </span>{' '}
            {lastActivePoint ? `Maior projeção de ${formatPercent(lastActivePoint.totalPercent)}.` : ''}
          </p>
        </div>
      )}

      <div
        className="-mx-1 mt-4 overflow-x-auto overscroll-x-contain rounded-lg px-1 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
        role="region"
        aria-label={`Projeção do percentual de faltas em ${discipline}`}
        tabIndex={0}
      >
        <ol className="flex min-w-max snap-x snap-mandatory items-start sm:w-full sm:min-w-0 sm:snap-none">
          {points.map((point, index) => {
            const isFirstRisk = point.key === firstRisk?.key;

            return (
              <li
                key={point.key}
                className="w-[76px] shrink-0 snap-start text-center tabular-nums sm:min-w-[64px] sm:flex-1"
                aria-current={isFirstRisk ? 'step' : undefined}
              >
                <div className="relative flex h-5 items-center justify-center" aria-hidden="true">
                  {index > 0 ? (
                    <span className="absolute left-0 right-1/2 h-px bg-gray-200 dark:bg-white/10" />
                  ) : null}
                  {index < points.length - 1 ? (
                    <span className="absolute left-1/2 right-0 h-px bg-gray-200 dark:bg-white/10" />
                  ) : null}
                  <span className={`relative size-2.5 rounded-full border-2 ring-4 ${markerClass(point)}`} />
                </div>
                <time
                  dateTime={format(point.date, 'yyyy-MM-dd')}
                  className="mt-1 block text-xs font-bold leading-4 text-gray-800 dark:text-gray-200"
                >
                  {format(point.date, 'dd/MM')}
                </time>
                {point.removed ? (
                  <span className={`mt-0.5 block text-[10px] font-medium leading-3 ${textClass(point)}`}>
                    não incluído
                  </span>
                ) : (
                  <>
                    <span className={`mt-0.5 block text-xs font-medium leading-4 ${textClass(point)}`}>
                      {formatPercent(point.totalPercent)}
                    </span>
                    {point.aboveLimit ? (
                      <span className="mt-0.5 block text-[10px] font-semibold leading-3 text-red-700 dark:text-red-300">
                        acima do limite
                      </span>
                    ) : (
                      <span className="sr-only">dentro do limite</span>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </figure>
  );
}
