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
import { ApiError } from '@/components/api-error';
import { EmptyState } from '@/components/empty-state';
import { TotvsOfflineBanner } from '@/components/totvs-offline-banner';
import { useHistorico, Disciplina, Periodo } from '@/hooks/use-historico';
import { isTotvsOfflineError } from '@/lib/api-response-error';

function isPeriodoLetivo(nome: string): boolean {
  const clean = nome.trim();
  return /^\d+[\º\°\.]?\s*(P|p)?(ERíodo|eríodo|eriodo|Semestre|SEMESTRE|semestre)/i.test(clean);
}

function isPeriodoConcluido(periodo: Periodo): boolean {
  if (periodo.disciplinas.length === 0) return false;
  const concluidas = periodo.disciplinas.filter(d =>
    d.status === 'concluida' || d.status === 'equivalente'
  ).length;
  return concluidas === periodo.disciplinas.length;
}

function parseNota(nota?: string): number | null {
  if (!nota) return null;
  const cleaned = nota.replace(',', '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function calcularMediaPeriodo(periodo: Periodo): string | null {
  if (!isPeriodoLetivo(periodo.nome)) return null;

  const notasParaMedia: number[] = [];
  let i = 0;

  while (i < periodo.disciplinas.length) {
    const disciplina = periodo.disciplinas[i];

    if (disciplina.status === 'equivalente') {
      i++;
      continue;
    }

    let j = i + 1;
    const hasEquivalentes = j < periodo.disciplinas.length && periodo.disciplinas[j].status === 'equivalente';

    if (hasEquivalentes) {
      const notasEquivalentes: number[] = [];
      while (j < periodo.disciplinas.length && periodo.disciplinas[j].status === 'equivalente') {
        const notaEquivalente = parseNota(periodo.disciplinas[j].nota);
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

  const mediaFinal = notasParaMedia.reduce((a, b) => a + b, 0) / notasParaMedia.length;
  return mediaFinal.toFixed(1);
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

function calcularMediaGlobal(periodos: Periodo[]): string | null {
  const medias: number[] = [];

  periodos.forEach(p => {
    if (isPeriodoLetivo(p.nome) && isPeriodoConcluido(p)) {
      const media = calcularMediaBloco(p);
      if (media !== null) {
        medias.push(media);
      }
    }
  });

  if (medias.length === 0) return null;

  const mediaGlobal = medias.reduce((a, b) => a + b, 0) / medias.length;
  return mediaGlobal.toFixed(1);
}

export default function HistoricoPage() {
  const { data, error, isLoading, isFetching, refetch, dataUpdatedAt } = useHistorico();

  const handleRefresh = async () => {
    const toastId = toast.loading('Atualizando...', { id: 'refresh-historico' });
    try {
      await refetch();
      toast.success('Atualizado com sucesso!', { id: toastId });
    } catch {
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
          color: 'text-blue-600 dark:text-blue-400',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          label: 'Equivalente'
        };
    }
  }

  const isOffline = isTotvsOfflineError(error);

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

  const totalDisciplinas = periodos.reduce((acc, p) => acc + p.disciplinas.length, 0);
  const totalConcluidas = periodosLetivos.reduce((acc, p) =>
    acc + p.disciplinas.filter(d => d.status === 'concluida' || d.status === 'equivalente').length, 0);

  const periodosConcluidos = periodosLetivos.filter(p => {
    const total = p.disciplinas.length;
    const concluidas = p.disciplinas.filter(d => d.status === 'concluida' || d.status === 'equivalente').length;
    return total > 0 && concluidas === total;
  });
  const progressPercent = periodosLetivos.length > 0
    ? Math.round((periodosConcluidos.length / periodosLetivos.length) * 100)
    : 0;

  const mediaGlobal = calcularMediaGlobal(periodos);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {isOffline && (
        <TotvsOfflineBanner />
      )}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Histórico Acadêmico
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Acompanhe seu progresso ao longo do curso
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              {lastUpdatedLabel && (
                <span>Atualizado {lastUpdatedLabel}</span>
              )}
              {isFetching && periodos.length ? (
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
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalConcluidas}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Concluídas</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                <XCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalDisciplinas - totalConcluidas}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Restantes</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{mediaGlobal || '-'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Média Global</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
        {[
          { icon: CheckCircle2, color: 'text-emerald-500', label: 'Concluída' },
          { icon: XCircle, color: 'text-amber-500', label: 'Pendente' },
          { icon: XCircle, color: 'text-red-500', label: 'Não Concluída' },
          { icon: AlertCircle, color: 'text-blue-500', label: 'Equivalente' },
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
          <div className="space-y-3">
            {periodosLetivos.map((periodo) => {
              const isExpanded = expandedPeriods.has(periodo.nome);
              const concluidasNoPeriodo = periodo.disciplinas.filter(d =>
                d.status === 'concluida' || d.status === 'equivalente'
              ).length;
              const mediaPeriodo = calcularMediaPeriodo(periodo);
              const periodoProgress = Math.round((concluidasNoPeriodo / periodo.disciplinas.length) * 100);
              const periodoConcluido = concluidasNoPeriodo === periodo.disciplinas.length;

              return (
                <div
                  key={periodo.nome}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() => togglePeriod(periodo.nome)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${periodoConcluido
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
                        : 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-400/20'
                        }`}>
                        <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="text-left min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white capitalize text-sm sm:text-base truncate">
                          {periodo.nome}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {periodo.disciplinas.length} disciplinas • {concluidasNoPeriodo} concluídas
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      {mediaPeriodo && (
                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-full border border-emerald-200 dark:border-emerald-900/50">
                          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            {mediaPeriodo}
                          </span>
                        </div>
                      )}
                      {mediaPeriodo && (
                        <div className="sm:hidden px-2 py-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
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

                  <div className="px-4 pb-3 -mt-1">
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                        style={{ width: `${periodoProgress}%` }}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      {periodo.disciplinas.map((disciplina, idx) => {
                        const statusConfig = getStatusConfig(disciplina.status);
                        const StatusIcon = statusConfig.icon;

                        return (
                          <div
                            key={`${disciplina.codigo}-${idx}`}
                            className={`p-4 border-b border-gray-50 dark:border-gray-700/50 last:border-b-0 ${disciplina.status === 'equivalente'
                              ? 'bg-blue-50/50 dark:bg-blue-950/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                              } transition-colors`}
                          >
                            <div className="flex gap-3">
                              <div className={`w-8 h-8 sm:w-10 sm:h-10 ${statusConfig.bg} rounded-xl flex items-center justify-center flex-shrink-0 border ${statusConfig.border}`}>
                                <StatusIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${statusConfig.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 mb-2">
                                  <h4 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base leading-tight">
                                    {disciplina.nome}
                                  </h4>
                                  <span className={`self-start px-2 py-0.5 text-xs font-medium rounded-lg ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border} whitespace-nowrap`}>
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
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {outrosBlocos.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            Outros Componentes
          </h2>
          <div className="space-y-3">
            {outrosBlocos.map((bloco) => {
              const isExpanded = expandedPeriods.has(bloco.nome);
              const mediaBloco = calcularMediaBloco(bloco);

              return (
                <div
                  key={bloco.nome}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() => togglePeriod(bloco.nome)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                      </div>
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
                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-full border border-blue-200 dark:border-blue-900/50">
                          <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {mediaBloco.toFixed(1)}
                          </span>
                        </div>
                      )}
                      {mediaBloco && (
                        <div className="sm:hidden px-2 py-1 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
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
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      {bloco.disciplinas.map((disciplina, idx) => {
                        const statusConfig = getStatusConfig(disciplina.status);
                        const StatusIcon = statusConfig.icon;

                        return (
                          <div
                            key={`${disciplina.codigo}-${idx}`}
                            className={`p-4 border-b border-gray-50 dark:border-gray-700/50 last:border-b-0 ${disciplina.status === 'equivalente'
                              ? 'bg-blue-50/50 dark:bg-blue-950/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                              } transition-colors`}
                          >
                            <div className="flex gap-3">
                              <div className={`w-8 h-8 sm:w-10 sm:h-10 ${statusConfig.bg} rounded-xl flex items-center justify-center flex-shrink-0 border ${statusConfig.border}`}>
                                <StatusIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${statusConfig.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 mb-2">
                                  <h4 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base leading-tight">
                                    {disciplina.nome}
                                  </h4>
                                  <span className={`self-start px-2 py-0.5 text-xs font-medium rounded-lg ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border} whitespace-nowrap`}>
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
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
