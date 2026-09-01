'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Info,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BookOpen,
  ClipboardList,
  Shield,
  RefreshCw,
  CalendarDays,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { PageLoading } from '@/components/page-loading';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { ApiError } from '@/components/api-error';
import { TotvsOfflineBanner } from '@/components/totvs-offline-banner';
import { EmptyState } from '@/components/empty-state';
import { useFaltas, FaltasItem } from '@/hooks/use-faltas';
import { isTotvsOfflineError } from '@/lib/api-response-error';
import { PageTransition, Stagger, StaggerItem } from '@/components/ui/app-motion';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeading } from '@/components/ui/page-heading';
import { AcademicPanel } from '@/components/ui/academic-panel';
import { AnimatedProgress } from '@/components/ui/animated-progress';
import { DatasFaltaSection } from '@/components/faltas/datas-falta-disclosure';
import {
  FrequencyRiskProjection,
  type FrequencyProjectionPoint,
} from '@/components/faltas/frequency-risk-projection';
import { queryKeys } from '@/lib/query-keys';

type FaltarRestanteInfo =
  | { status: 'insufficient' }
  | { status: 'limit' }
  | { status: 'no-events' }
  | { status: 'impossible' }
  | {
    status: 'already-possible';
    eventsRemaining: number;
    daysRemaining: number;
    percentRemaining: number;
    totalPercent: number;
  }
  | {
    status: 'possible';
    date: Date;
    eventsRemaining: number;
    daysRemaining: number;
    percentRemaining: number;
    totalPercent: number;
  };

interface AulaDiaRestante {
  key: string;
  date: Date;
  horarios: Date[];
}

interface AulasPorDiaSemana {
  key: string;
  label: string;
  order: number;
  dias: AulaDiaRestante[];
}

function parsePercent(value?: string): number | null {
  if (!value) return null;
  const normalized = value.replace('%', '').replace(',', '.').trim();
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatPercent(value: number, decimals = 1): string {
  const formatted = value.toFixed(decimals).replace('.', ',');
  return `${formatted.replace(/,0+$/, '')}%`;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getAulasDiasRestantes(item: FaltasItem): AulaDiaRestante[] {
  const dias = new Map<string, AulaDiaRestante>();

  (item.eventosFuturos || []).forEach((eventDate) => {
    const date = new Date(eventDate);
    if (Number.isNaN(date.getTime())) return;

    const key = format(date, 'yyyy-MM-dd');
    const existing = dias.get(key);
    if (existing) {
      existing.horarios.push(date);
      return;
    }

    dias.set(key, {
      key,
      date,
      horarios: [date],
    });
  });

  return Array.from(dias.values())
    .map((dia) => ({
      ...dia,
      horarios: dia.horarios.sort((a, b) => a.getTime() - b.getTime()),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getAulasPorDiaSemana(dias: AulaDiaRestante[]): AulasPorDiaSemana[] {
  const grupos = new Map<string, AulasPorDiaSemana>();

  dias.forEach((dia) => {
    const day = dia.date.getDay();
    const key = String(day);
    const order = day === 0 ? 7 : day;
    const label = capitalize(format(dia.date, 'EEEE', { locale: ptBR }));
    const grupo = grupos.get(key);

    if (grupo) {
      grupo.dias.push(dia);
      return;
    }

    grupos.set(key, {
      key,
      label,
      order,
      dias: [dia],
    });
  });

  return Array.from(grupos.values())
    .map((grupo) => ({
      ...grupo,
      dias: grupo.dias.sort((a, b) => a.date.getTime() - b.date.getTime()),
    }))
    .sort((a, b) => a.order - b.order);
}

function getFaltarRestanteInfo(item: FaltasItem, diasRemovidos: Set<string> = new Set()): FaltarRestanteInfo {
  const limite = parsePercent(item.limiteFaltas);
  const porEvento = parsePercent(item.umaFaltaPct);
  const percentualAtual = item.porcentagemValor;

  if (limite === null || porEvento === null) {
    return { status: 'insufficient' };
  }

  if (percentualAtual >= limite) {
    return { status: 'limit' };
  }

  const diasFuturos = getAulasDiasRestantes(item);

  if (diasFuturos.length === 0) {
    return { status: 'no-events' };
  }

  const diasAtivosFuturos = diasFuturos.filter((dia) => !diasRemovidos.has(dia.key));
  if (diasAtivosFuturos.length === 0) {
    return { status: 'no-events' };
  }

  const totalAulasAtivas = diasAtivosFuturos.reduce((total, dia) => total + dia.horarios.length, 0);
  const percentualTodasAulasAtivas = totalAulasAtivas * porEvento;
  const totalSeFaltarTudo = percentualAtual + percentualTodasAulasAtivas;

  if (totalSeFaltarTudo <= limite + 0.0001) {
    return {
      status: 'already-possible',
      eventsRemaining: totalAulasAtivas,
      daysRemaining: diasAtivosFuturos.length,
      percentRemaining: percentualTodasAulasAtivas,
      totalPercent: totalSeFaltarTudo,
    };
  }

  for (let i = 0; i < diasFuturos.length; i += 1) {
    const diasRestantes = diasFuturos.slice(i);
    const diasAtivosRestantes = diasRestantes.filter((dia) => !diasRemovidos.has(dia.key));
    const aulasRestantes = diasAtivosRestantes.reduce((total, dia) => total + dia.horarios.length, 0);
    const percentSeFaltar = percentualAtual + aulasRestantes * porEvento;

    if (percentSeFaltar <= limite + 0.0001) {
      return {
        status: 'possible',
        date: diasFuturos[i].date,
        eventsRemaining: aulasRestantes,
        daysRemaining: diasAtivosRestantes.length,
        percentRemaining: aulasRestantes * porEvento,
        totalPercent: percentSeFaltar,
      };
    }
  }

  return { status: 'impossible' };
}

function getLinhaTempoRisco(
  item: FaltasItem,
  diasRemovidos: Set<string>,
): FrequencyProjectionPoint[] {
  const limite = parsePercent(item.limiteFaltas);
  const porEvento = parsePercent(item.umaFaltaPct);

  if (limite === null || porEvento === null) return [];

  let aulasAcumuladas = 0;
  const linhaTempo = getAulasDiasRestantes(item).map((dia) => {
    const removido = diasRemovidos.has(dia.key);
    if (!removido) {
      aulasAcumuladas += dia.horarios.length;
    }

    const totalPercent = item.porcentagemValor + aulasAcumuladas * porEvento;

    return {
      key: dia.key,
      date: dia.date,
      removed: removido,
      totalPercent,
      aboveLimit: totalPercent > limite + 0.0001,
    };
  });

  const primeiroRiscoIndex = linhaTempo.findIndex((dia) => dia.aboveLimit && !dia.removed);
  return primeiroRiscoIndex >= 0
    ? linhaTempo.slice(0, primeiroRiscoIndex + 1)
    : linhaTempo;
}

export default function FaltasPage() {
  const { data, error, isLoading, isFetching, fetchStatus, refetch, dataUpdatedAt } = useFaltas();
  const queryClient = useQueryClient();
  const [expandedDisciplinas, setExpandedDisciplinas] = useState<Set<string>>(new Set());
  const [expandedAulas, setExpandedAulas] = useState<Set<string>>(new Set());
  const [expandedDiasSemana, setExpandedDiasSemana] = useState<Set<string>>(new Set());
  const [diasRemovidosPorDisciplina, setDiasRemovidosPorDisciplina] = useState<Record<string, string[]>>({});

  const handleRefresh = async () => {
    const toastId = toast.loading('Atualizando...', { id: 'refresh-faltas' });
    try {
      const result = await refetch();
      if (result.error) {
        throw result.error;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.faltasDatasRoot() });
      toast.success('Atualizado com sucesso!', { id: toastId });
    } catch (err) {
      if (isTotvsOfflineError(err)) {
        toast.error('Sistema da TOTVS possivelmente fora do ar.', { id: toastId });
        return;
      }
      toast.error('Erro ao atualizar. Tente novamente.', { id: toastId });
    }
  };

  const faltas = data?.faltas || [];
  const lastUpdatedLabel = dataUpdatedAt
    ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: ptBR })
    : null;

  function toggleDisciplina(codigo: string) {
    setExpandedDisciplinas((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) {
        next.delete(codigo);
      } else {
        next.add(codigo);
      }
      return next;
    });
  }

  function toggleAulas(codigo: string) {
    setExpandedAulas((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) {
        next.delete(codigo);
      } else {
        next.add(codigo);
      }
      return next;
    });
  }

  function toggleDiaRemovido(codigo: string, diaKey: string) {
    setDiasRemovidosPorDisciplina((prev) => {
      const atuais = new Set(prev[codigo] || []);
      if (atuais.has(diaKey)) {
        atuais.delete(diaKey);
      } else {
        atuais.add(diaKey);
      }
      return {
        ...prev,
        [codigo]: Array.from(atuais),
      };
    });
  }

  function setDiasDoGrupoRemovidos(codigo: string, diaKeys: string[], remover: boolean) {
    setDiasRemovidosPorDisciplina((prev) => {
      const atuais = new Set(prev[codigo] || []);
      diaKeys.forEach((diaKey) => {
        if (remover) {
          atuais.add(diaKey);
        } else {
          atuais.delete(diaKey);
        }
      });

      return {
        ...prev,
        [codigo]: Array.from(atuais),
      };
    });
  }

  function restaurarDias(codigo: string) {
    setDiasRemovidosPorDisciplina((prev) => {
      const next = { ...prev };
      delete next[codigo];
      return next;
    });
  }

  function getStatusConfig(status: FaltasItem['status']) {
    switch (status) {
      case 'abaixo':
        return {
          icon: CheckCircle,
          color: 'text-emerald-600 dark:text-emerald-400',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20',
          barColor: 'bg-emerald-500',
          label: 'Seguro'
        };
      case 'proximo':
        return {
          icon: AlertTriangle,
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20',
          barColor: 'bg-amber-500',
          label: 'Atenção'
        };
      case 'acima':
        return {
          icon: XCircle,
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          barColor: 'bg-red-500',
          label: 'Crítico'
        };
    }
  }

  if (isLoading && fetchStatus === 'paused') {
    return (
      <EmptyState
        title="Sem dados salvos"
        description="Conecte-se uma vez e abra este módulo para disponibilizá-lo offline."
        icon="clipboard"
        retry={() => void refetch()}
      />
    );
  }

  function toggleGrupoDiaSemana(codigo: string, grupoKey: string) {
    const disclosureKey = `${codigo}:${grupoKey}`;
    setExpandedDiasSemana((prev) => {
      const next = new Set(prev);
      if (next.has(disclosureKey)) {
        next.delete(disclosureKey);
      } else {
        next.add(disclosureKey);
      }
      return next;
    });
  }

  if (isLoading) {
    return <PageLoading message="Carregando faltas..." />;
  }

  if (error && !data) {
    return <ApiError error={error} retry={() => refetch()} />;
  }

  // Stats
  const totalDisciplinas = faltas.length;
  const disciplinasSeguras = faltas.filter(f => f.status === 'abaixo').length;
  const disciplinasAtencao = faltas.filter(f => f.status === 'proximo').length;
  const disciplinasCriticas = faltas.filter(f => f.status === 'acima').length;

  return (
    <PageTransition className="app-page">
      {(error && data) || data?.__cacheStale || fetchStatus === 'paused' ? (
        <TotvsOfflineBanner updatedAt={data?.__cacheStale ? undefined : dataUpdatedAt} onRetry={() => void refetch()} />
      ) : null}
      <PageHeading
        icon={ClipboardList}
        title="Controle de faltas"
        meta={lastUpdatedLabel ? <span className="inline-flex items-center gap-1.5">Atualizado {lastUpdatedLabel}{isFetching ? <RefreshCw className="size-3.5 animate-spin text-primary" /> : null}</span> : undefined}
        actions={<Button variant="outline" size="icon" onClick={handleRefresh} disabled={isFetching} aria-label="Atualizar" className="hidden sm:inline-flex"><RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} /></Button>}
        desktopActionsOnly
      />

      <Stagger className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StaggerItem className="h-full"><MetricCard tile icon={BookOpen} label="Disciplinas" value={totalDisciplinas} /></StaggerItem>
        <StaggerItem className="h-full"><MetricCard tile icon={Shield} label="Seguras" value={disciplinasSeguras} /></StaggerItem>
        <StaggerItem className="h-full"><MetricCard tile icon={AlertTriangle} label="Atenção" value={disciplinasAtencao} /></StaggerItem>
        <StaggerItem className="h-full"><MetricCard tile icon={XCircle} label="Críticas" value={disciplinasCriticas} /></StaggerItem>
      </Stagger>

      {/* Legenda */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 px-1">
        {[
          { icon: CheckCircle, color: 'text-emerald-500', label: 'Seguro' },
          { icon: AlertTriangle, color: 'text-amber-500', label: 'Próximo do limite' },
          { icon: XCircle, color: 'text-red-500', label: 'Acima do limite' },
        ].map(({ icon: Icon, color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Lista de Faltas */}
      <div>
        {faltas.length === 0 ? (
          <EmptyState title="Nenhuma falta registrada" description="Não há informações de faltas disponíveis." icon="clipboard" />
        ) : (
          <section aria-label="Faltas por disciplina" className="academic-stack">
          {faltas.map((item) => {
            const statusConfig = getStatusConfig(item.status);
            const StatusIcon = statusConfig.icon;
            const diasRemovidos = new Set(diasRemovidosPorDisciplina[item.codigo] || []);
            const aulasDiasRestantes = getAulasDiasRestantes(item);
            const aulasPorDiaSemana = getAulasPorDiaSemana(aulasDiasRestantes);
            const diasAtivos = aulasDiasRestantes.filter((dia) => !diasRemovidos.has(dia.key));
            const horariosAtivos = diasAtivos.reduce((total, dia) => total + dia.horarios.length, 0);
            const horariosTotais = aulasDiasRestantes.reduce((total, dia) => total + dia.horarios.length, 0);
            const faltarInfo = getFaltarRestanteInfo(item, diasRemovidos);
            const linhaTempoRisco = getLinhaTempoRisco(item, diasRemovidos);
            const disciplinaExpanded = expandedDisciplinas.has(item.codigo);
            const aulasExpanded = expandedAulas.has(item.codigo);
            const disciplinaPanelId = `faltas-disciplina-${item.codigo.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            const limiteNum = parsePercent(item.limiteFaltas) ?? 0;
            const progressWidth = limiteNum > 0
              ? Math.min((item.porcentagemValor / limiteNum) * 100, 100)
              : 0;

            return (
              <AcademicPanel
                key={item.codigo}
                expanded={disciplinaExpanded}
              >
                <div>
                  <div className="relative px-4 sm:px-5">
                    <button
                      type="button"
                      data-absence-summary
                      onClick={() => toggleDisciplina(item.codigo)}
                      className="group flex w-full items-center gap-3 pb-8 pt-4 text-left transition-opacity hover:opacity-90 active:opacity-75 motion-reduce:transition-none sm:gap-4 sm:pb-9 sm:pt-5"
                      aria-expanded={disciplinaExpanded}
                      aria-controls={disciplinaPanelId}
                    >
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border ${statusConfig.bg} ${statusConfig.border}`}>
                        <StatusIcon className={`size-5 ${statusConfig.color}`} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold leading-snug text-gray-950 dark:text-white sm:text-base">
                          {item.disciplina}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                          <span className={`text-xs font-semibold ${statusConfig.color}`}>{statusConfig.label}</span>
                          <span className="text-xs font-medium tabular-nums text-gray-500 sm:hidden dark:text-gray-400">
                            <span className={`font-bold ${statusConfig.color}`}>{item.porcentagem}</span> de {item.limiteFaltas}
                          </span>
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-right sm:block">
                        <span className={`block text-sm font-bold tabular-nums ${statusConfig.color}`}>
                          {item.porcentagem}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          de {item.limiteFaltas}
                        </span>
                      </span>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-gray-200/80 bg-white/55 text-gray-500 shadow-sm transition-colors group-hover:text-gray-900 dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-gray-400 dark:group-hover:text-white">
                        <ChevronDown
                          className={`size-4 transition-transform duration-300 motion-reduce:transition-none ${disciplinaExpanded ? 'rotate-180' : ''}`}
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                    <div className="pointer-events-none absolute inset-x-4 bottom-4 ml-14 sm:inset-x-5 sm:bottom-5 sm:ml-[3.75rem]">
                      <AnimatedProgress
                        value={progressWidth}
                        ariaLabel={`${item.disciplina}: ${item.porcentagem} de ${item.limiteFaltas}`}
                        className="h-1.5 bg-gray-200/80 dark:bg-gray-700"
                        indicatorClassName={statusConfig.barColor}
                      />
                    </div>
                  </div>

                  {disciplinaExpanded ? (
                  <div id={disciplinaPanelId} className="detail-reveal divide-y divide-gray-200/75 border-t border-gray-200/75 px-4 dark:divide-white/[0.065] dark:border-white/[0.065] sm:px-5">
                  {item.umaFaltaPct && item.ch ? (
                    <div className="flex items-center gap-2 py-4 text-xs leading-5 text-gray-500 dark:text-gray-400">
                      <Info className="size-4 shrink-0 text-primary" />
                      <span>Cada falta de 50 minutos equivale a <strong className="font-semibold text-gray-900 dark:text-white">{item.umaFaltaPct} da carga horária</strong>.</span>
                    </div>
                  ) : null}
                  <DatasFaltaSection
                    codigo={item.codigo}
                  />
                  <section aria-labelledby={`simulacao-${item.codigo}`} className="py-4 sm:py-5">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Clock className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h4 id={`simulacao-${item.codigo}`} className="text-sm font-bold text-gray-950 dark:text-white">
                          Simulação de faltas futuras
                        </h4>
                        <p className="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-400">
                          Veja o impacto de faltar nas próximas aulas sem alterar seus registros reais.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.035] p-3.5 dark:bg-primary/[0.055] sm:p-4">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Resultado da simulação
                      </p>
                      {(() => {
                        if (faltarInfo.status === 'insufficient') {
                          return (
                            <p className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                              Ainda não há dados suficientes para calcular.
                            </p>
                          );
                        }
                        if (faltarInfo.status === 'limit') {
                          return (
                            <p className="mt-1.5 text-sm font-semibold text-red-700 dark:text-red-300">
                              Você já atingiu o limite de faltas.
                            </p>
                          );
                        }
                        if (faltarInfo.status === 'no-events') {
                          return (
                            <p className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                              Não há aulas futuras para simular.
                            </p>
                          );
                        }
                        if (faltarInfo.status === 'impossible') {
                          return (
                            <p className="mt-1.5 text-sm font-semibold text-red-700 dark:text-red-300">
                              Não há uma data segura dentro do limite atual.
                            </p>
                          );
                        }

                        const possibleDate = faltarInfo.status === 'possible'
                          ? faltarInfo.date
                          : null;

                        return (
                          <>
                            <p className="mt-1.5 text-sm font-bold leading-5 text-gray-950 dark:text-white sm:text-base">
                              {possibleDate
                                ? <>A partir de <time dateTime={format(possibleDate, 'yyyy-MM-dd')}>{format(possibleDate, 'dd/MM/yyyy')}</time>, você ficaria dentro do limite mesmo faltando às aulas seguintes.</>
                                : 'Você ficaria dentro do limite mesmo faltando às aulas restantes.'}
                            </p>
                            <dl className="mt-3 grid grid-cols-2 rounded-xl border border-primary/10 bg-white/55 dark:border-white/[0.07] dark:bg-gray-950/20 sm:grid-cols-3">
                              <div className="px-3 py-2.5">
                                <dt className="text-xs text-gray-500 dark:text-gray-400">Dias restantes</dt>
                                <dd className="mt-0.5 text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                                  {faltarInfo.daysRemaining}
                                </dd>
                              </div>
                              <div className="border-l border-primary/15 px-3 py-2.5 dark:border-white/[0.07]">
                                <dt className="text-xs text-gray-500 dark:text-gray-400">Acréscimo</dt>
                                <dd className="mt-0.5 text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                                  +{formatPercent(faltarInfo.percentRemaining)}
                                </dd>
                              </div>
                              <div className="col-span-2 border-t border-primary/15 px-3 py-2.5 sm:col-span-1 sm:border-l sm:border-t-0 dark:border-white/[0.07]">
                                <dt className="text-xs text-gray-500 dark:text-gray-400">Total projetado</dt>
                                <dd className="mt-0.5 text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                                  {formatPercent(faltarInfo.totalPercent)}
                                </dd>
                              </div>
                            </dl>
                          </>
                        );
                      })()}
                      <FrequencyRiskProjection
                        id={`projecao-${item.codigo.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
                        discipline={item.disciplina}
                        limitLabel={item.limiteFaltas}
                        points={linhaTempoRisco}
                      />
                    </div>

                  <div className="mt-4 flex flex-col gap-2 border-t border-gray-200/75 pt-4 dark:border-white/[0.065] sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => toggleAulas(item.codigo)}
                      className="group flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-gray-950/[0.025] motion-reduce:transition-none dark:hover:bg-white/[0.025]"
                      aria-expanded={aulasExpanded}
                      aria-controls={`aulas-${item.codigo}`}
                    >
                      <CalendarDays className="size-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                          Aulas consideradas na simulação
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                          {diasAtivos.length}/{aulasDiasRestantes.length} dias e {horariosAtivos}/{horariosTotais} aulas incluídas
                        </span>
                      </span>
                      <ChevronDown
                        className={`size-4 shrink-0 text-gray-400 transition-transform duration-200 motion-reduce:transition-none ${aulasExpanded ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                    {diasRemovidos.size > 0 && (
                      <button
                        type="button"
                        onClick={() => restaurarDias(item.codigo)}
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 motion-reduce:transition-none dark:text-gray-300 dark:hover:bg-white/[0.055]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        Incluir todas
                      </button>
                    )}
                  </div>

                  {aulasExpanded && (
                    <div id={`aulas-${item.codigo}`} className="detail-reveal mt-3 border-t border-gray-200/75 pt-3 dark:border-white/[0.065]">
                      {aulasDiasRestantes.length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Nenhuma aula futura encontrada para esta disciplina.
                        </p>
                      ) : (
                        <div className="divide-y divide-gray-200/75 dark:divide-white/[0.065]">
                          {aulasPorDiaSemana.map((grupo) => {
                            const diaKeys = grupo.dias.map((dia) => dia.key);
                            const disclosureKey = `${item.codigo}:${grupo.key}`;
                            const grupoExpanded = expandedDiasSemana.has(disclosureKey);
                            const grupoPanelId = `aulas-${item.codigo}-dia-${grupo.key}`;
                            const diasRemovidosNoGrupo = grupo.dias.filter((dia) => diasRemovidos.has(dia.key)).length;
                            const grupoTodoRemovido = diasRemovidosNoGrupo === grupo.dias.length;
                            const totalHorarios = grupo.dias.reduce((total, dia) => total + dia.horarios.length, 0);
                            const horariosAtivosNoGrupo = grupo.dias
                              .filter((dia) => !diasRemovidos.has(dia.key))
                              .reduce((total, dia) => total + dia.horarios.length, 0);

                            return (
                              <div
                                key={grupo.key}
                                className={`py-3 ${grupoTodoRemovido ? 'opacity-60' : ''}`}
                              >
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleGrupoDiaSemana(item.codigo, grupo.key)}
                                    className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-2 text-left transition-colors motion-reduce:transition-none hover:bg-gray-950/[0.035] dark:hover:bg-white/[0.035]"
                                    aria-expanded={grupoExpanded}
                                    aria-controls={grupoPanelId}
                                  >
                                    <span className="min-w-0">
                                      <span className={`block text-sm font-semibold ${grupoTodoRemovido ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                        {grupo.label}
                                      </span>
                                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                        {grupo.dias.length} {grupo.dias.length === 1 ? 'dia' : 'dias'} de aula, {horariosAtivosNoGrupo}/{totalHorarios} aulas incluídas
                                      </span>
                                    </span>
                                    <ChevronDown
                                      className={`size-4 shrink-0 text-gray-400 transition-transform duration-200 motion-reduce:transition-none ${grupoExpanded ? 'rotate-180' : ''}`}
                                      aria-hidden="true"
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={!grupoTodoRemovido}
                                    aria-label={`Incluir ${grupo.label} na simulação`}
                                    onClick={() => setDiasDoGrupoRemovidos(item.codigo, diaKeys, !grupoTodoRemovido)}
                                    className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 motion-reduce:transition-none dark:text-gray-300 dark:hover:bg-white/[0.055]"
                                  >
                                    <span className="hidden sm:inline">Incluir</span>
                                    <span className={`relative h-5 w-8 shrink-0 rounded-full p-0.5 transition-colors ${grupoTodoRemovido ? 'bg-gray-300 dark:bg-gray-700' : 'bg-primary'}`} aria-hidden="true">
                                      <span className={`block size-4 rounded-full bg-white shadow-sm transition-transform ${grupoTodoRemovido ? '' : 'translate-x-3'}`} />
                                    </span>
                                  </button>
                                </div>

                                {grupoExpanded ? (
                                  <div id={grupoPanelId} className="detail-reveal mt-3 divide-y divide-gray-200/65 border-t border-gray-200/65 dark:divide-white/[0.055] dark:border-white/[0.055]">
                                    {grupo.dias.map((dia) => {
                                      const removido = diasRemovidos.has(dia.key);
                                      const horariosLabel = dia.horarios
                                        .map((horario) => format(horario, 'HH:mm'))
                                        .join(', ');

                                      return (
                                        <div
                                          key={dia.key}
                                          className={`flex items-center justify-between gap-3 py-2.5 ${removido ? 'opacity-60' : ''}`}
                                        >
                                          <div className="min-w-0">
                                            <p className={`text-sm font-semibold ${removido ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                              {format(dia.date, 'dd/MM')}
                                            </p>
                                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                              {dia.horarios.length} {dia.horarios.length === 1 ? 'aula' : 'aulas'}
                                              {horariosLabel ? `: ${horariosLabel}` : ''}
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            role="switch"
                                            aria-checked={!removido}
                                            aria-label={`Incluir ${format(dia.date, 'dd/MM/yyyy')} na simulação`}
                                            onClick={() => toggleDiaRemovido(item.codigo, dia.key)}
                                            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 motion-reduce:transition-none dark:text-gray-300 dark:hover:bg-white/[0.055]"
                                          >
                                            <span className="hidden sm:inline">Incluir</span>
                                            <span className={`relative h-5 w-8 shrink-0 rounded-full p-0.5 transition-colors ${removido ? 'bg-gray-300 dark:bg-gray-700' : 'bg-primary'}`} aria-hidden="true">
                                              <span className={`block size-4 rounded-full bg-white shadow-sm transition-transform ${removido ? '' : 'translate-x-3'}`} />
                                            </span>
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  </section>
                  </div>
                  ) : null}
                </div>
              </AcademicPanel>
            );
          })}
          </section>
        )}
      <PullToRefresh onRefresh={handleRefresh} />
      </div>
    </PageTransition>
  );
}
