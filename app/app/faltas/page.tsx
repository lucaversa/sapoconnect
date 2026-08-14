'use client';

import { useState } from 'react';
import {
  Clock,
  Info,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BookOpen,
  Shield,
  RefreshCw,
  CalendarDays,
  Trash2,
  RotateCcw,
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

interface LinhaTempoRiscoItem {
  dia: AulaDiaRestante;
  removido: boolean;
  totalPercent: number;
  aulasAcumuladas: number;
  acimaLimite: boolean;
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

function getLinhaTempoRisco(item: FaltasItem, diasRemovidos: Set<string>): LinhaTempoRiscoItem[] {
  const limite = parsePercent(item.limiteFaltas);
  const porEvento = parsePercent(item.umaFaltaPct);

  if (limite === null || porEvento === null) return [];

  let aulasAcumuladas = 0;
  return getAulasDiasRestantes(item).map((dia) => {
    const removido = diasRemovidos.has(dia.key);
    if (!removido) {
      aulasAcumuladas += dia.horarios.length;
    }

    const totalPercent = item.porcentagemValor + aulasAcumuladas * porEvento;

    return {
      dia,
      removido,
      totalPercent,
      aulasAcumuladas,
      acimaLimite: totalPercent > limite + 0.0001,
    };
  });
}

export default function FaltasPage() {
  const { data, error, isLoading, isFetching, fetchStatus, refetch, dataUpdatedAt } = useFaltas();
  const [expandedAulas, setExpandedAulas] = useState<Set<string>>(new Set());
  const [diasRemovidosPorDisciplina, setDiasRemovidosPorDisciplina] = useState<Record<string, string[]>>({});

  const handleRefresh = async () => {
    const toastId = toast.loading('Atualizando...', { id: 'refresh-faltas' });
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

  const faltas = data?.faltas || [];
  const lastUpdatedLabel = dataUpdatedAt
    ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: ptBR })
    : null;

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
        icon={Shield}
        title="Controle de faltas"
        meta={lastUpdatedLabel ? <span className="inline-flex items-center gap-1.5">Atualizado {lastUpdatedLabel}{isFetching ? <RefreshCw className="size-3.5 animate-spin text-primary" /> : null}</span> : undefined}
        actions={<Button variant="outline" size="icon" onClick={handleRefresh} disabled={isFetching} aria-label="Atualizar" className="hidden sm:inline-flex"><RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} /></Button>}
        desktopActionsOnly
      />

      <Stagger className="grid grid-cols-1 gap-2.5 min-[440px]:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        <StaggerItem><MetricCard compact icon={BookOpen} label="Disciplinas" value={totalDisciplinas} /></StaggerItem>
        <StaggerItem><MetricCard compact icon={Shield} label="Seguras" value={disciplinasSeguras} /></StaggerItem>
        <StaggerItem><MetricCard compact icon={AlertTriangle} label="Atenção" value={disciplinasAtencao} /></StaggerItem>
        <StaggerItem><MetricCard compact icon={XCircle} label="Críticas" value={disciplinasCriticas} /></StaggerItem>
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
            const faltarInfo = getFaltarRestanteInfo(item, diasRemovidos);
            const linhaTempoRisco = getLinhaTempoRisco(item, diasRemovidos);
            const primeiroDiaCritico = linhaTempoRisco.find((dia) => dia.acimaLimite && !dia.removido);
            const aulasExpanded = expandedAulas.has(item.codigo);

            return (
              <AcademicPanel
                key={item.codigo}
                expanded={aulasExpanded}
              >
                <div className="p-4 sm:p-5">
                  {/* Header da disciplina */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${statusConfig.color}`}>
                        <StatusIcon className="size-4" /> {statusConfig.label}
                      </span>
                      <h3 className="mt-2 text-sm font-bold leading-snug text-gray-950 dark:text-white sm:text-base">
                        {item.disciplina}
                      </h3>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-3xl font-extrabold leading-none tabular-nums ${statusConfig.color}`}>{item.porcentagem}</p>
                      <p className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">limite {item.limiteFaltas}</p>
                    </div>
                  </div>

                  {item.umaFaltaPct && item.ch ? (
                    <div className="mt-4 flex items-center gap-2 border-y border-gray-200/75 py-3 text-xs text-gray-500 dark:border-white/[0.065] dark:text-gray-400">
                      <Info className="size-4 shrink-0 text-primary" />
                      <span>1 falta (50 minutos) equivale a <strong className="font-semibold text-gray-900 dark:text-white">{item.umaFaltaPct} da carga horária</strong></span>
                    </div>
                  ) : null}
                  {/* Posso faltar a partir de? */}
                  <div className="mt-4 w-full border-l-2 border-primary/55 px-3 py-1">
                    <div className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-900 dark:text-white">
                          Posso faltar a partir de?
                        </p>
                        {(() => {
                          if (faltarInfo.status === 'insufficient') {
                            return (
                              <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
                                Dados insuficientes.
                              </p>
                            );
                          }
                          if (faltarInfo.status === 'limit') {
                            return (
                              <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
                                Já está no limite.
                              </p>
                            );
                          }
                          if (faltarInfo.status === 'no-events') {
                            return (
                              <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
                                Sem aulas futuras.
                              </p>
                            );
                          }
                          if (faltarInfo.status === 'impossible') {
                            return (
                              <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
                                Não é possível.
                              </p>
                            );
                          }

                          if (faltarInfo.status === 'already-possible') {
                            return (
                              <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  Você já pode faltar nas aulas restantes.
                                </span>{' '}
                                Restam {faltarInfo.daysRemaining} dias de aula ({formatPercent(faltarInfo.percentRemaining)}) • Total final {formatPercent(faltarInfo.totalPercent)}
                              </p>
                            );
                          }

                          const dateLabel = format(faltarInfo.date, 'dd/MM/yyyy');
                          return (
                            <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                Data: {dateLabel}
                              </span>{' '}
                              • Restarão {faltarInfo.daysRemaining} dias de aula ({formatPercent(faltarInfo.percentRemaining)}) • Total {formatPercent(faltarInfo.totalPercent)}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {linhaTempoRisco.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          Risco por dia
                        </p>
                        {primeiroDiaCritico ? (
                          <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300">
                            Risco em {format(primeiroDiaCritico.dia.date, 'dd/MM')}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                            Seguro
                          </span>
                        )}
                      </div>

                      <div className="-mx-1 overflow-x-auto px-1 pb-1">
                        <div className="flex min-w-max gap-1.5">
                        {linhaTempoRisco.map((marco) => {
                          const colorClass = marco.removido
                            ? 'border-gray-300 text-gray-400 opacity-70 dark:border-gray-700 dark:text-gray-500'
                            : marco.acimaLimite
                              ? 'border-red-500 text-red-700 dark:border-red-500/80 dark:text-red-300'
                              : 'border-emerald-500 text-emerald-700 dark:border-emerald-500/80 dark:text-emerald-300';

                          return (
                            <div
                              key={marco.dia.key}
                              className={`w-[64px] shrink-0 border-t-2 px-1 py-2 text-center ${colorClass}`}
                            >
                              <p className="text-[10px] font-bold">{format(marco.dia.date, 'dd/MM')}</p>
                              <p className="mt-0.5 text-[9px] leading-tight">
                                {marco.removido ? 'removido' : formatPercent(marco.totalPercent)}
                              </p>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAulas(item.codigo)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors motion-reduce:transition-none hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:bg-gray-900"
                      aria-expanded={aulasExpanded}
                      aria-controls={`aulas-${item.codigo}`}
                    >
                      <CalendarDays className="h-4 w-4" />
                      Aulas restantes
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {diasAtivos.length} dias / {horariosAtivos} aulas
                      </span>
                    </button>
                    {diasRemovidos.size > 0 && (
                      <button
                        type="button"
                        onClick={() => restaurarDias(item.codigo)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition-colors motion-reduce:transition-none hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restaurar dias
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
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <p className={`text-sm font-semibold ${grupoTodoRemovido ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>
                                      {grupo.label}
                                    </p>
                                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                      {grupo.dias.length} {grupo.dias.length === 1 ? 'dia' : 'dias'} de aula • {horariosAtivosNoGrupo}/{totalHorarios} aulas ativas
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setDiasDoGrupoRemovidos(item.codigo, diaKeys, !grupoTodoRemovido)}
                                    className={`inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-colors motion-reduce:transition-none sm:w-fit ${
                                      grupoTodoRemovido
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50'
                                        : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50'
                                    }`}
                                  >
                                    {grupoTodoRemovido ? (
                                      <>
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Repor {grupo.label}
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Remover {grupo.label}
                                      </>
                                    )}
                                  </button>
                                </div>

                                <div className="mt-3 divide-y divide-gray-200/65 border-t border-gray-200/65 dark:divide-white/[0.055] dark:border-white/[0.055]">
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
                                          <p className={`text-sm font-semibold ${removido ? 'text-red-700 dark:text-red-300 line-through' : 'text-gray-900 dark:text-white'}`}>
                                            {format(dia.date, 'dd/MM')}
                                          </p>
                                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                            {dia.horarios.length} {dia.horarios.length === 1 ? 'aula' : 'aulas'}
                                            {horariosLabel ? `: ${horariosLabel}` : ''}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => toggleDiaRemovido(item.codigo, dia.key)}
                                          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-colors motion-reduce:transition-none ${
                                            removido
                                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50'
                                              : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50'
                                          }`}
                                        >
                                          {removido ? (
                                            <>
                                              <RotateCcw className="h-3.5 w-3.5" />
                                              Repor dia
                                            </>
                                          ) : (
                                            <>
                                              <Trash2 className="h-3.5 w-3.5" />
                                              Remover dia
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Barra de progresso */}
                  <div className="mt-4">
                    {(() => {
                      const limiteNum = parseFloat(item.limiteFaltas.replace('%', '').replace(',', '.'));
                      const faltasNum = item.porcentagemValor;
                      const progressWidth = limiteNum > 0 ? Math.min((faltasNum / limiteNum) * 100, 100) : 0;
                      return (
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Faltas / Limite</span>
                            <span className={`text-xs font-medium ${statusConfig.color}`}>{item.porcentagem} / {item.limiteFaltas}</span>
                          </div>
                          <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${statusConfig.barColor} transition-[width] duration-300 motion-reduce:transition-none`}
                              style={{ width: `${progressWidth}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-gray-400">0%</span>
                            <span className="text-[10px] text-gray-400">{item.limiteFaltas}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
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
