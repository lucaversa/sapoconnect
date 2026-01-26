'use client';

import { useState, useCallback } from 'react';
import {
  ChevronDown,
  FileText,
  Calendar,
  Award,
  TrendingUp,
  GraduationCap,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { PageLoading } from '@/components/page-loading';
import { ApiError } from '@/components/api-error';
import { EmptyState } from '@/components/empty-state';
import { TotvsOfflineBanner } from '@/components/totvs-offline-banner';
import { useAvaliacoes, useAvaliacoesNotas } from '@/hooks/use-avaliacoes';
import { isTotvsOfflineError } from '@/lib/api-response-error';

export default function AvaliacoesPage() {
  const { data: disciplinasData, error, isLoading, isFetching, refetch, dataUpdatedAt } = useAvaliacoes();

  const handleRefresh = async () => {
    const toastId = toast.loading('Atualizando...', { id: 'refresh-avaliacoes' });
    try {
      await refetch();
      toast.success('Atualizado com sucesso!', { id: toastId });
    } catch {
      toast.error('Erro ao atualizar. Tente novamente.', { id: toastId });
    }
  };
  const [expandedCodigo, setExpandedCodigo] = useState<string | null>(null);

  const disciplinas = disciplinasData?.disciplinas || [];
  const lastUpdatedLabel = dataUpdatedAt
    ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: ptBR })
    : null;

  // Carregar notas da disciplina expandida
  const { data: avaliacoesData, isLoading: notasLoading, error: notasError } = useAvaliacoesNotas(
    expandedCodigo || ''
  );
  const isNotasOffline = isTotvsOfflineError(notasError);

  const toggleDisciplina = (codigo: string) => {
    setExpandedCodigo(prev => (prev === codigo ? null : codigo));
  };

  function getCategoriaIcon(categoria: string) {
    switch (categoria) {
      case 'Avaliação Parcial':
      case 'Nota Parcial':
        return FileText;
      case 'Avaliação Somativa':
      case 'Nota Somativa':
        return Award;
      case 'Avaliação Formativa':
      case 'Nota Formativa':
        return TrendingUp;
      case 'Exame Especial':
        return Calendar;
      case 'Nota Final':
        return GraduationCap;
      default:
        return FileText;
    }
  }

  function getCategoriaGradient(categoria: string) {
    switch (categoria) {
      case 'Avaliação Parcial':
      case 'Nota Parcial':
        return {
          bg: 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20',
          text: 'text-blue-600 dark:text-blue-400',
          border: 'border-blue-500/20'
        };
      case 'Avaliação Somativa':
      case 'Nota Somativa':
        return {
          bg: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20',
          text: 'text-purple-600 dark:text-purple-400',
          border: 'border-purple-500/20'
        };
      case 'Avaliação Formativa':
      case 'Nota Formativa':
        return {
          bg: 'bg-gradient-to-br from-amber-500/20 to-orange-500/20',
          text: 'text-amber-600 dark:text-amber-400',
          border: 'border-amber-500/20'
        };
      case 'Exame Especial':
        return {
          bg: 'bg-gradient-to-br from-red-500/20 to-rose-500/20',
          text: 'text-red-600 dark:text-red-400',
          border: 'border-red-500/20'
        };
      case 'Nota Final':
        return {
          bg: 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20',
          text: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-500/20'
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-gray-500/20 to-slate-500/20',
          text: 'text-gray-600 dark:text-gray-400',
          border: 'border-gray-500/20'
        };
    }
  }

  function getStatusFromPorcentagem(porcentagem: number, mediaParaAprovacao: number) {
    if (porcentagem >= mediaParaAprovacao) return 'aprovado';
    return 'reprovado';
  }

  const isOffline = isTotvsOfflineError(error);

  if (isLoading) {
    return <PageLoading message="Carregando avaliações..." />;
  }

  if (error && !disciplinasData) {
    return <ApiError error={error} retry={() => refetch()} />;
  }

  if (disciplinas.length === 0) {
    return <EmptyState title="Nenhuma avaliação" description="Nenhuma informação de avaliações disponível." icon="clipboard" retry={() => refetch()} />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {isOffline && (
        <TotvsOfflineBanner />
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Avaliações
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Visualize suas notas por disciplina
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {lastUpdatedLabel && (
              <span>Atualizado {lastUpdatedLabel}</span>
            )}
            {isFetching && disciplinas.length ? (
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

      {/* Lista de Disciplinas */}
      <div className="space-y-3">
        {disciplinas.map((disciplina) => {
          const resultado = expandedCodigo === disciplina.codigo ? avaliacoesData : undefined;
          const status = resultado?.somativaGeralPorcentagem !== undefined
            ? getStatusFromPorcentagem(resultado.somativaGeralPorcentagem, resultado.mediaParaAprovacao)
            : null;

          const statusConfig = {
            aprovado: {
              icon: CheckCircle,
              color: 'text-emerald-600 dark:text-emerald-400',
              bg: 'bg-emerald-500/10',
              border: 'border-emerald-500/20'
            },
            reprovado: {
              icon: XCircle,
              color: 'text-red-600 dark:text-red-400',
              bg: 'bg-red-500/10',
              border: 'border-red-500/20'
            }
          };

          const currentStatus = status ? statusConfig[status] : null;
          const StatusIcon = currentStatus?.icon || GraduationCap;
          const isExpanded = expandedCodigo === disciplina.codigo;

          return (
            <div
              key={disciplina.codigo}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm"
            >
              {/* Header da Disciplina */}
              <button
                onClick={() => toggleDisciplina(disciplina.codigo)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${currentStatus
                    ? `${currentStatus.bg} ${currentStatus.border} border`
                    : 'bg-gradient-to-br from-purple-500 to-pink-600 shadow-purple-500/20'
                    }`}>
                    {currentStatus ? (
                      <StatusIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${currentStatus.color}`} />
                    ) : (
                      <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    )}
                  </div>
                  <div className="text-left min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                      {disciplina.nome}
                    </h3>
                    {resultado?.somativaGeral !== undefined && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Média: {resultado.somativaGeralPorcentagem}%
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  {resultado?.somativaGeralPorcentagem !== undefined && (
                    <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${currentStatus ? `${currentStatus.bg} ${currentStatus.border}` : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}>
                      <span className={`text-sm font-semibold ${currentStatus?.color || 'text-gray-600 dark:text-gray-400'}`}>
                        {resultado.somativaGeralPorcentagem}%
                      </span>
                    </div>
                  )}
                  {notasLoading && isExpanded ? (
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''
                        }`}
                    />
                  )}
                </div>
              </button>

              {/* Conteúdo Expandido */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  {notasError && (!resultado || resultado.categorias.length === 0) ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {notasError.message}
                      </p>
                      <button
                        onClick={() => toggleDisciplina(disciplina.codigo)}
                        className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  ) : resultado && resultado.categorias.length > 0 ? (
                    <div className="p-4 space-y-4">
                      {notasError && isNotasOffline && (
                        <TotvsOfflineBanner message="Sistema da TOTVS possivelmente fora do ar. Exibindo dados em cache." />
                      )}
                      {/* Somativa Geral */}
                      {resultado.somativaGeral !== undefined && (
                        <div className={`flex items-center justify-between p-4 rounded-xl border ${currentStatus ? `${currentStatus.bg} ${currentStatus.border}` : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                          }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentStatus ? currentStatus.bg : 'bg-gray-100 dark:bg-gray-800'
                              }`}>
                              <GraduationCap className={`w-5 h-5 ${currentStatus?.color || 'text-gray-600 dark:text-gray-400'}`} />
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${currentStatus?.color || 'text-gray-900 dark:text-white'}`}>
                                Somativa Geral
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Média para aprovação: {resultado.mediaParaAprovacao}%
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-bold ${currentStatus?.color || 'text-gray-900 dark:text-white'}`}>
                              {resultado.somativaGeralPorcentagem}%
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {resultado.somativaGeral}/100
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Categorias */}
                      <div className="space-y-4">
                        {resultado.categorias.map((categoria) => {
                          const CatIcon = getCategoriaIcon(categoria.nome);
                          const catStyle = getCategoriaGradient(categoria.nome);

                          return (
                            <div key={categoria.nome} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                              {/* Header da Categoria */}
                              <div className={`flex items-center justify-between px-3 py-2 mb-3 rounded-lg border ${catStyle.border} ${catStyle.bg}`}>
                                <div className="flex items-center gap-2">
                                  <CatIcon className={`w-4 h-4 ${catStyle.text}`} />
                                  <span className={`text-sm font-semibold ${catStyle.text}`}>{categoria.nome}</span>
                                </div>
                                {categoria.valorTotal! > 0 && (
                                  <div className="text-right">
                                    <span className={`text-sm font-bold ${catStyle.text}`}>
                                      {categoria.notaTotal?.toFixed(1).replace('.', ',') || '0'}/{categoria.valorTotal?.toFixed(1).replace('.', ',') || '0'}
                                    </span>
                                    <span className={`text-xs ml-1 opacity-70 ${catStyle.text}`}>
                                      ({categoria.porcentagem?.toFixed(1).replace('.', ',') || '0'}%)
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Avaliações */}
                              <div className="space-y-2">
                                {categoria.avaliacoes.map((avaliacao, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-800 rounded-lg"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {avaliacao.nome}
                                      </p>
                                      {avaliacao.data && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                          <Calendar className="w-3 h-3" />
                                          {avaliacao.data}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                      {avaliacao.valor && (
                                        <span className="text-xs text-gray-400">/{avaliacao.valor}</span>
                                      )}
                                      {(() => {
                                        let notaColor = 'text-gray-400 dark:text-gray-600';
                                        if (avaliacao.nota && avaliacao.nota !== '' && avaliacao.valor) {
                                          const notaNum = parseFloat(avaliacao.nota.replace(',', '.'));
                                          const valorNum = parseFloat(avaliacao.valor.replace(',', '.'));
                                          if (!isNaN(notaNum) && !isNaN(valorNum) && valorNum > 0) {
                                            const porcentagem = (notaNum / valorNum) * 100;
                                            notaColor = porcentagem < 60
                                              ? 'text-red-600 dark:text-red-400'
                                              : 'text-emerald-600 dark:text-emerald-400';
                                          }
                                        }
                                        return (
                                          <span className={`text-base font-bold min-w-[2rem] text-right ${avaliacao.nota && avaliacao.nota !== ''
                                            ? notaColor
                                            : 'text-gray-400 dark:text-gray-600'
                                          }`}>
                                            {avaliacao.nota && avaliacao.nota !== '' ? avaliacao.nota : '-'}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : notasLoading ? (
                    <div className="p-8 text-center">
                      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Carregando avaliações...</p>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhuma avaliação registrada
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
