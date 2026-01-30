'use client';

import {
  Clock,
  Calendar,
  Info,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BookOpen,
  Hash,
  TrendingDown,
  Shield,
  Timer,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { PageLoading } from '@/components/page-loading';
import { ApiError } from '@/components/api-error';
import { EmptyState } from '@/components/empty-state';
import { TotvsOfflineBanner } from '@/components/totvs-offline-banner';
import { useFaltas, FaltasItem } from '@/hooks/use-faltas';
import { isTotvsOfflineError } from '@/lib/api-response-error';
import { motion, type Variants } from 'framer-motion';

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1], when: 'beforeChildren', staggerChildren: 0.04 },
  },
};

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

type FaltarRestanteInfo =
  | { status: 'insufficient' }
  | { status: 'limit' }
  | { status: 'no-events' }
  | { status: 'impossible' }
  | {
    status: 'possible';
    date: Date;
    eventsRemaining: number;
    daysRemaining: number;
    percentRemaining: number;
    totalPercent: number;
  };

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

function getFaltarRestanteInfo(item: FaltasItem): FaltarRestanteInfo {
  const limite = parsePercent(item.limiteFaltas);
  const porEvento = parsePercent(item.umaFaltaPct);
  const percentualAtual = item.porcentagemValor;

  if (limite === null || porEvento === null) {
    return { status: 'insufficient' };
  }

  if (percentualAtual >= limite) {
    return { status: 'limit' };
  }

  const eventosFuturos = (item.eventosFuturos || [])
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (eventosFuturos.length === 0) {
    return { status: 'no-events' };
  }

  const totalEventos = eventosFuturos.length;

  for (let i = 0; i < totalEventos; i += 1) {
    const eventosRestantes = totalEventos - i;
    const percentSeFaltar = percentualAtual + eventosRestantes * porEvento;

    if (percentSeFaltar <= limite + 0.0001) {
      const daysRemaining = new Set(
        eventosFuturos.slice(i).map((eventDate) => format(eventDate, 'yyyy-MM-dd'))
      ).size;

      return {
        status: 'possible',
        date: eventosFuturos[i],
        eventsRemaining: eventosRestantes,
        daysRemaining,
        percentRemaining: eventosRestantes * porEvento,
        totalPercent: percentSeFaltar,
      };
    }
  }

  return { status: 'impossible' };
}

export default function FaltasPage() {
  const { data, error, isLoading, isFetching, refetch, dataUpdatedAt } = useFaltas();

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

  const isOffline = isTotvsOfflineError(error);

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
    <motion.div
      className="p-4 sm:p-6 space-y-6"
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      {isOffline && (
        <motion.div variants={sectionVariants}>
          <TotvsOfflineBanner />
        </motion.div>
      )}
      {/* Header */}
      <motion.div variants={sectionVariants} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Controle de Faltas
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Acompanhe sua frequência em cada disciplina
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              {lastUpdatedLabel && (
                <span>Atualizado {lastUpdatedLabel}</span>
              )}
              {isFetching && faltas.length ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Atualizando dados...
                </span>
              ) : null}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center justify-center w-10 h-10 text-gray-500 border border-gray-200 rounded-lg dark:border-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            aria-label="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalDisciplinas}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Disciplinas</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{disciplinasSeguras}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Seguras</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{disciplinasAtencao}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Atenção</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-xl flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{disciplinasCriticas}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Críticas</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Legenda */}
      <motion.div variants={sectionVariants} className="flex flex-wrap gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
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
      </motion.div>

      {/* Lista de Faltas */}
      <motion.div variants={sectionVariants}>
        {faltas.length === 0 ? (
          <EmptyState title="Nenhuma falta registrada" description="Não há informações de faltas disponíveis." icon="clipboard" />
        ) : (
          <div className="space-y-3">
          {faltas.map((item) => {
            const statusConfig = getStatusConfig(item.status);
            const StatusIcon = statusConfig.icon;
            const faltarInfo = getFaltarRestanteInfo(item);

            return (
              <div
                key={item.codigo}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm"
              >
                <div className="p-4">
                  {/* Header da disciplina */}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 ${statusConfig.bg} rounded-xl flex items-center justify-center flex-shrink-0 border ${statusConfig.border}`}>
                      <StatusIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${statusConfig.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base leading-tight">
                            {item.disciplina}
                          </h3>
                        </div>

                        <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border} whitespace-nowrap`}>
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Faltas */}
                    <div className={`rounded-xl p-3 ${statusConfig.bg} border ${statusConfig.border}`}>
                      <div className="flex items-center gap-2">
                        <TrendingDown className={`w-4 h-4 ${statusConfig.color}`} />
                        <p className="text-xs text-gray-500 dark:text-gray-400">Faltas</p>
                      </div>
                      <p className={`text-xl font-bold mt-1 ${statusConfig.color}`}>
                        {item.porcentagem}
                      </p>
                    </div>

                    {/* Limite */}
                    <div className="rounded-xl p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">Limite</p>
                      </div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                        {item.limiteFaltas}
                      </p>
                    </div>

                    {/* Info sobre 1 falta */}
                    {item.umaFaltaPct && item.ch && (
                      <div className="col-span-2 rounded-xl p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">1 falta (50 minutos) equivale a</p>
                            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mt-0.5">
                              {item.umaFaltaPct} da carga horária
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Estatísticas de aulas */}
                  {(item.aulasTotal !== undefined || item.aulasRealizadas !== undefined || item.diasRestantes !== undefined) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.aulasTotal !== undefined && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/50">
                          <Timer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            <span className="font-semibold">{item.aulasTotal}</span> aulas totais
                          </span>
                        </div>
                      )}
                      {item.aulasRealizadas !== undefined && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs text-emerald-700 dark:text-emerald-300">
                            <span className="font-semibold">{item.aulasRealizadas}</span> realizadas
                          </span>
                        </div>
                      )}
                      {item.diasRestantes !== undefined && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-900/50">
                          <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs text-amber-700 dark:text-amber-300">
                            <span className="font-semibold">{item.diasRestantes}</span> dias restantes
                          </span>
                        </div>
                      )}

                      <div className="w-full sm:w-[240px] rounded-lg border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-2">
                        <div className="flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                          <div>
                            <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold">
                              Posso faltar a partir de?
                            </p>
                            {(() => {
                              if (faltarInfo.status === 'insufficient') {
                                return (
                                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                                    Dados insuficientes.
                                  </p>
                                );
                              }
                              if (faltarInfo.status === 'limit') {
                                return (
                                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                                    Já está no limite.
                                  </p>
                                );
                              }
                              if (faltarInfo.status === 'no-events') {
                                return (
                                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                                    Sem aulas futuras.
                                  </p>
                                );
                              }
                              if (faltarInfo.status === 'impossible') {
                                return (
                                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                                    Não é possível.
                                  </p>
                                );
                              }

                              const dateLabel = format(faltarInfo.date, 'dd/MM/yyyy');
                              return (
                                <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                                  <span className="font-semibold text-indigo-800 dark:text-indigo-200">
                                    Data: {dateLabel}
                                  </span>{' '}
                                  • Restarão {faltarInfo.daysRemaining} dias de aula ({formatPercent(faltarInfo.percentRemaining)}) • Total {formatPercent(faltarInfo.totalPercent)}
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
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
                              className={`h-full rounded-full ${statusConfig.barColor} animate-[grow_0.8s_ease-out_forwards]`}
                              style={{
                                '--progress-width': `${progressWidth}%`,
                                width: '0%',
                                animation: 'grow 0.8s ease-out forwards'
                              } as React.CSSProperties}
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
              </div>
            );
          })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
