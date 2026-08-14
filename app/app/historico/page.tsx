'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  RefreshCw,
  TrendingUp,
  BookOpen,
  GraduationCap,
  Award,
  Hash,
  Timer
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { PageLoading } from '@/components/page-loading';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { ApiError } from '@/components/api-error';
import { TotvsOfflineBanner } from '@/components/totvs-offline-banner';
import { EmptyState } from '@/components/empty-state';
import { useHistorico, Disciplina, Periodo } from '@/hooks/use-historico';
import { isTotvsOfflineError } from '@/lib/api-response-error';
import { PageTransition, Stagger, StaggerItem } from '@/components/ui/app-motion';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeading } from '@/components/ui/page-heading';
import { AcademicPanel } from '@/components/ui/academic-panel';

function isPeriodoLetivo(nome: string): boolean {
  const clean = nome.trim();
  return /^\d+[\º\°\.]?\s*(P|p)?(ERíodo|eríodo|eriodo|Semestre|SEMESTRE|semestre)/i.test(clean);
}

function parseNota(nota?: string): number | null {
  if (!nota) return null;
  const cleaned = nota.replace(',', '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function calcularMediaPeriodo(periodo: Periodo): string | null {
  if (!isPeriodoLetivo(periodo.nome)) return null;

  const media = calcularMediaBloco(periodo);
  return media === null ? null : media.toFixed(1);
}

function calcularMediaBloco(bloco: Periodo): number | null {
  const notasParaMedia: number[] = [];
  let i = 0;

  while (i < bloco.disciplinas.length) {
    const disciplina = bloco.disciplinas[i];

    if (disciplina.status === 'equivalente') {
      i++;
      continue;
    }

    let j = i + 1;
    const hasEquivalentes = j < bloco.disciplinas.length && bloco.disciplinas[j].status === 'equivalente';

    if (hasEquivalentes) {
      const notasEquivalentes: number[] = [];
      while (j < bloco.disciplinas.length && bloco.disciplinas[j].status === 'equivalente') {
        const notaEquivalente = parseNota(bloco.disciplinas[j].nota);
        if (notaEquivalente !== null) {
          notasEquivalentes.push(notaEquivalente);
        }
        j++;
      }

      if (notasEquivalentes.length > 0) {
        const mediaEquivalente = notasEquivalentes.reduce((a, b) => a + b, 0) / notasEquivalentes.length;
        notasParaMedia.push(mediaEquivalente);
      }
    } else {
      const nota = parseNota(disciplina.nota);
      if (nota !== null) {
        notasParaMedia.push(nota);
      }
      j = i + 1;
    }

    i = j;
  }

  if (notasParaMedia.length === 0) return null;

  return notasParaMedia.reduce((a, b) => a + b, 0) / notasParaMedia.length;
}

export default function HistoricoPage() {
  const { data, error, isLoading, isFetching, fetchStatus, refetch, dataUpdatedAt } = useHistorico();

  const handleRefresh = async () => {
    const toastId = toast.loading('Atualizando...', { id: 'refresh-historico' });
    try {
      const result = await refetch();
      if (result.error) {
        throw result.error;
      }
      toast.success('Atualizado com sucesso!', { id: toastId });
    } catch (err) {
      if (isTotvsOfflineError(err)) {
        toast.error('Sistema da TOTVS possivelmente fora do ar.', { id: toastId });
        return;
      }
      toast.error('Erro ao atualizar. Tente novamente.', { id: toastId });
    }
  };

  const periodos = data?.periodos || [];
  const lastUpdatedLabel = dataUpdatedAt
    ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: ptBR })
    : null;
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());

  function togglePeriod(periodoNome: string) {
    const newExpanded = new Set(expandedPeriods);
    if (newExpanded.has(periodoNome)) {
      newExpanded.delete(periodoNome);
    } else {
      newExpanded.add(periodoNome);
    }
    setExpandedPeriods(newExpanded);
  }

  function getStatusConfig(status: Disciplina['status']) {
    switch (status) {
      case 'concluida':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-600 dark:text-emerald-400',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20',
          label: 'Concluída'
        };
      case 'pendente':
        return {
          icon: XCircle,
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20',
          label: 'Pendente'
        };
      case 'naoconcluida':
        return {
          icon: XCircle,
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          label: 'Não Concluída'
        };
      case 'equivalente':
        return {
          icon: AlertCircle,
          color: 'text-gray-600 dark:text-gray-300',
          bg: 'bg-gray-100 dark:bg-gray-800',
          border: 'border-gray-200 dark:border-gray-700',
          label: 'Equivalente'
        };
    }
  }

  if (isLoading && fetchStatus === 'paused') {
    return (
      <EmptyState
        title="Sem dados salvos"
        description="Conecte-se uma vez e abra este módulo para disponibilizá-lo offline."
        icon="book"
        retry={() => void refetch()}
      />
    );
  }

  if (isLoading) {
    return <PageLoading message="Carregando histórico..." />;
  }

  if (error && !data) {
    return <ApiError error={error} retry={() => refetch()} />;
  }

  if (periodos.length === 0) {
    return <EmptyState title="Nenhum histórico" description="Nenhuma informação de histórico disponível." icon="book" />;
  }

  const periodosLetivos = periodos.filter(p => isPeriodoLetivo(p.nome));
  const outrosBlocos = periodos.filter(p => !isPeriodoLetivo(p.nome));

  const totalDisciplinas = periodos.reduce((acc, p) =>
    acc + p.disciplinas.filter(d => d.status !== 'equivalente').length, 0);
  const totalConcluidas = periodosLetivos.reduce((acc, p) =>
    acc + p.disciplinas.filter(d => d.status === 'concluida').length, 0);

  return (
    <PageTransition className="app-page">
      {(error && data) || data?.__cacheStale || fetchStatus === 'paused' ? (
        <TotvsOfflineBanner updatedAt={data?.__cacheStale ? undefined : dataUpdatedAt} onRetry={() => void refetch()} />
      ) : null}
      <PageHeading
        icon={GraduationCap}
        title="Histórico acadêmico"
        meta={lastUpdatedLabel ? <span className="inline-flex items-center gap-1.5">Atualizado {lastUpdatedLabel}{isFetching ? <RefreshCw className="size-3.5 animate-spin text-primary" /> : null}</span> : undefined}
        actions={<Button variant="outline" size="icon" onClick={handleRefresh} disabled={isFetching} aria-label="Atualizar" className="hidden sm:inline-flex"><RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} /></Button>}
        desktopActionsOnly
      />

      <Stagger className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        <StaggerItem><MetricCard compact icon={BookOpen} label="Disciplinas" value={totalDisciplinas} /></StaggerItem>
        <StaggerItem><MetricCard compact icon={CheckCircle2} label="Concluídas" value={totalConcluidas} /></StaggerItem>
        <StaggerItem><MetricCard compact icon={XCircle} label="Restantes" value={totalDisciplinas - totalConcluidas} /></StaggerItem>
      </Stagger>

      <div className="flex flex-wrap gap-x-5 gap-y-2 px-1">
        {[
          { icon: CheckCircle2, color: 'text-emerald-500', label: 'Concluída' },
          { icon: XCircle, color: 'text-amber-500', label: 'Pendente' },
          { icon: XCircle, color: 'text-red-500', label: 'Não Concluída' },
          { icon: AlertCircle, color: 'text-gray-500 dark:text-gray-400', label: 'Equivalente' },
        ].map(({ icon: Icon, color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {periodosLetivos.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-500" />
            Períodos Letivos
          </h2>
          <section aria-label="Períodos letivos" className="academic-stack">
            {periodosLetivos.map((periodo) => {
              const isExpanded = expandedPeriods.has(periodo.nome);
              const panelId = `periodo-${periodo.nome.replace(/\s+/g, '-')}`;
              const disciplinasContabilizadasNoPeriodo = periodo.disciplinas.filter(d =>
                d.status !== 'equivalente'
              );
              const concluidasNoPeriodo = disciplinasContabilizadasNoPeriodo.filter(d =>
                d.status === 'concluida'
              ).length;
              const totalDisciplinasNoPeriodo = disciplinasContabilizadasNoPeriodo.length;
              const mediaPeriodo = calcularMediaPeriodo(periodo);
              const periodoProgress = totalDisciplinasNoPeriodo > 0
                ? Math.round((concluidasNoPeriodo / totalDisciplinasNoPeriodo) * 100)
                : 0;
              const periodoConcluido = totalDisciplinasNoPeriodo > 0
                && concluidasNoPeriodo === totalDisciplinasNoPeriodo;

              return (
                <AcademicPanel
                  key={periodo.nome}
                  expanded={isExpanded}
                >
                  <button
                    type="button"
                    onClick={() => togglePeriod(periodo.nome)}
                    className="flex min-h-16 w-full items-center justify-between p-4 transition-colors motion-reduce:transition-none hover:bg-gray-50/80 dark:hover:bg-white/[0.025] sm:px-5"
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GraduationCap className={`h-5 w-5 shrink-0 ${periodoConcluido ? 'text-emerald-500' : 'text-gray-400'}`} />
                      <div className="text-left min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white capitalize text-sm sm:text-base truncate">
                          {periodo.nome}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {totalDisciplinasNoPeriodo} disciplinas • {concluidasNoPeriodo} concluídas
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      {mediaPeriodo && (
                        <div className="hidden items-center gap-1.5 sm:flex">
                          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            {mediaPeriodo}
                          </span>
                        </div>
                      )}
                      {mediaPeriodo && (
                        <div className="sm:hidden">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {mediaPeriodo}
                          </span>
                        </div>
                      )}
                      <ChevronDown
                        className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''
                          }`}
                      />
                    </div>
                  </button>

                  <div className="px-4 pb-3 -mt-1 sm:px-5">
                    <div className="h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${periodoProgress}%` }}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                      <div id={panelId} className="detail-reveal overflow-hidden motion-reduce:transition-none">
                        <div className="academic-panel-body">
                      {periodo.disciplinas.map((disciplina, idx) => {
                        const statusConfig = getStatusConfig(disciplina.status);
                        const StatusIcon = statusConfig.icon;

                        return (
                          <div
                            key={`${disciplina.codigo}-${idx}`}
                            className="border-b border-gray-200/65 p-4 transition-colors last:border-b-0 hover:bg-gray-50/70 dark:border-white/[0.055] dark:hover:bg-white/[0.02] sm:px-5"
                          >
                            <div className="flex gap-3">
                              <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${statusConfig.color}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 mb-2">
                                  <h4 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base leading-tight">
                                    {disciplina.nome}
                                  </h4>
                                  <span className={`self-start text-xs font-semibold ${statusConfig.color} whitespace-nowrap`}>
                                    {statusConfig.label}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                  <div className="flex items-center gap-1">
                                    <Hash className="w-3 h-3" />
                                    <span>{disciplina.codigo}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Timer className="w-3 h-3" />
                                    <span>{disciplina.ch}h</span>
                                  </div>
                                  {disciplina.nota && (
                                    <div className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                                      <Award className="w-3 h-3" />
                                      <span>Nota: {disciplina.nota}</span>
                                    </div>
                                  )}
                                  {disciplina.faltas && (
                                    <div className="flex items-center gap-1">
                                      <XCircle className="w-3 h-3" />
                                      <span>{disciplina.faltas} faltas</span>
                                    </div>
                                  )}
                                </div>
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                  {disciplina.situacao}
                                  {disciplina.periodo && (
                                    <span className="ml-2 text-gray-400 dark:text-gray-500">
                                      • {disciplina.periodo}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                </AcademicPanel>
              );
            })}
          </section>
        </div>
      )}

      {outrosBlocos.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-500" />
            Outros Componentes
          </h2>
          <section aria-label="Outros componentes" className="academic-stack">
            {outrosBlocos.map((bloco) => {
              const isExpanded = expandedPeriods.has(bloco.nome);
              const panelId = `bloco-${bloco.nome.replace(/\s+/g, '-')}`;
              const mediaBloco = calcularMediaBloco(bloco);

              return (
                <AcademicPanel
                  key={bloco.nome}
                  expanded={isExpanded}
                >
                  <button
                    type="button"
                    onClick={() => togglePeriod(bloco.nome)}
                    className="flex min-h-16 w-full items-center justify-between p-4 transition-colors motion-reduce:transition-none hover:bg-gray-50/80 dark:hover:bg-white/[0.025] sm:px-5"
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <BookOpen className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div className="text-left min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white capitalize text-sm sm:text-base truncate">
                          {bloco.nome}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {bloco.disciplinas.length} disciplinas
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      {mediaBloco && (
                        <div className="hidden items-center gap-1.5 sm:flex">
                          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            {mediaBloco.toFixed(1)}
                          </span>
                        </div>
                      )}
                      {mediaBloco && (
                        <div className="sm:hidden">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {mediaBloco.toFixed(1)}
                          </span>
                        </div>
                      )}
                      <ChevronDown
                        className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''
                          }`}
                      />
                    </div>
                  </button>

                  {isExpanded && (
                      <div id={panelId} className="detail-reveal overflow-hidden motion-reduce:transition-none">
                        <div className="academic-panel-body">
                      {bloco.disciplinas.map((disciplina, idx) => {
                        const statusConfig = getStatusConfig(disciplina.status);
                        const StatusIcon = statusConfig.icon;

                        return (
                          <div
                            key={`${disciplina.codigo}-${idx}`}
                            className="border-b border-gray-200/65 p-4 transition-colors last:border-b-0 hover:bg-gray-50/70 dark:border-white/[0.055] dark:hover:bg-white/[0.02] sm:px-5"
                          >
                            <div className="flex gap-3">
                              <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${statusConfig.color}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 mb-2">
                                  <h4 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base leading-tight">
                                    {disciplina.nome}
                                  </h4>
                                  <span className={`self-start text-xs font-semibold ${statusConfig.color} whitespace-nowrap`}>
                                    {statusConfig.label}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                  <div className="flex items-center gap-1">
                                    <Hash className="w-3 h-3" />
                                    <span>{disciplina.codigo}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Timer className="w-3 h-3" />
                                    <span>{disciplina.ch}h</span>
                                  </div>
                                  {disciplina.nota && (
                                    <div className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                                      <Award className="w-3 h-3" />
                                      <span>Nota: {disciplina.nota}</span>
                                    </div>
                                  )}
                                  {disciplina.faltas && (
                                    <div className="flex items-center gap-1">
                                      <XCircle className="w-3 h-3" />
                                      <span>{disciplina.faltas} faltas</span>
                                    </div>
                                  )}
                                </div>
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                  {disciplina.situacao}
                                  {disciplina.periodo && (
                                    <span className="ml-2 text-gray-400 dark:text-gray-500">
                                      • {disciplina.periodo}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                </AcademicPanel>
              );
            })}
          </section>
        </div>
      )}
      <PullToRefresh onRefresh={handleRefresh} />
    </PageTransition>
  );
}
