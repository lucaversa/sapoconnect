'use client';

import { useState } from 'react';
import {
  ChevronDown,
  FileText,
  Calendar,
  Award,
  TrendingUp,
  GraduationCap,
  Star,
  CheckCircle,
  Layers,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { PageLoading } from '@/components/page-loading';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { ApiError } from '@/components/api-error';
import { TotvsOfflineBanner } from '@/components/totvs-offline-banner';
import { EmptyState } from '@/components/empty-state';
import { ResultadoAvaliacoes, useAvaliacoesCompleto } from '@/hooks/use-avaliacoes';
import { isTotvsOfflineError } from '@/lib/api-response-error';
import { PageTransition, Stagger, StaggerItem } from '@/components/ui/app-motion';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeading } from '@/components/ui/page-heading';
import { AcademicPanel } from '@/components/ui/academic-panel';
import { AnimatedSegmentedProgress } from '@/components/ui/animated-progress';
import { calculateEvaluationLaunchProgress, isSpecialEvaluation } from '@/lib/evaluation-progress';

const TOTAL_PONTOS = 100;

function parseNumber(value?: string): number | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.toString().trim();
  if (trimmed === '') return null;
  const parsed = parseFloat(trimmed.replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
}

function formatNumber(value: number, decimals = 1): string {
  const formatted = value.toFixed(decimals).replace('.', ',');
  return formatted.replace(/,0+$/, '');
}

function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isCategoriaDeResumo(nome: string): boolean {
  const normalized = normalizeText(nome);
  return normalized === 'nota parcial'
    || normalized === 'nota final'
    || normalized === 'nota somativa'
    || normalized.includes('somatorio')
    || normalized.includes('total');
}

function isAvaliacaoDeResumo(categoriaNome: string, avaliacaoNome: string): boolean {
  if (isCategoriaDeResumo(categoriaNome)) return true;

  const normalized = normalizeText(avaliacaoNome);
  return normalized === 'nota parcial'
    || normalized === 'nota final'
    || normalized === 'nota somativa'
    || normalized.includes('somatorio')
    || normalized.includes('total')
    || normalized.includes('media final');
}

function hasNotaLancada(nota?: string): boolean {
  return parseNumber(nota) !== null;
}

export default function AvaliacoesPage() {
  const { data: disciplinasData, error, isLoading, isFetching, fetchStatus, refetch, dataUpdatedAt } = useAvaliacoesCompleto();

  const handleRefresh = async () => {
    const toastId = toast.loading('Atualizando...', { id: 'refresh-avaliacoes' });
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
  const [expandedCodigo, setExpandedCodigo] = useState<string | null>(null);

  const disciplinas = disciplinasData?.disciplinas || [];
  const disciplinasOrdenadas = [...disciplinas].sort((a, b) => {
    const notaA = getResumoPontos(a.resultado)?.lancados;
    const notaB = getResumoPontos(b.resultado)?.lancados;
    const temNotaA = typeof notaA === 'number';
    const temNotaB = typeof notaB === 'number';

    if (temNotaA && temNotaB) {
      if (notaB !== notaA) return notaB - notaA;
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    }

    if (temNotaA) return -1;
    if (temNotaB) return 1;

    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  });
  const lastUpdatedLabel = dataUpdatedAt
    ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: ptBR })
    : null;

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

function getCategoriaStyle(categoria: string) {
    switch (categoria) {
      case 'Avaliação Parcial':
      case 'Nota Parcial':
        return {
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-700 dark:text-emerald-300',
          border: 'border-emerald-500/20'
        };
      case 'Avaliação Somativa':
      case 'Nota Somativa':
        return {
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-700 dark:text-emerald-300',
          border: 'border-emerald-500/20'
        };
      case 'Avaliação Formativa':
      case 'Nota Formativa':
        return {
          bg: 'bg-gray-100 dark:bg-gray-800',
          text: 'text-amber-600 dark:text-amber-400',
          border: 'border-amber-500/20'
        };
      case 'Exame Especial':
        return {
          bg: 'bg-red-500/10',
          text: 'text-red-600 dark:text-red-400',
          border: 'border-red-500/20'
        };
      case 'Nota Final':
        return {
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-500/20'
        };
      default:
        return {
          bg: 'bg-gray-100 dark:bg-gray-800',
          text: 'text-gray-600 dark:text-gray-400',
          border: 'border-gray-500/20'
        };
    }
  }

  function hasNotasPendentes(resultado: ResultadoAvaliacoes): boolean {
    return (getResumoPontos(resultado)?.pendenteTotal ?? 0) > 0;
  }

  function getStatusFromResultado(resultado: ResultadoAvaliacoes) {
    const somativa = getResumoPontos(resultado)?.lancados ?? 0;
    if (somativa >= resultado.mediaParaAprovacao) return 'aprovado';
    if (hasNotasPendentes(resultado)) return 'pendente';
    return 'reprovado';
  }

  function getAproveitamentoLancado(resultado: ResultadoAvaliacoes): number | null {
    let pontosLancados = 0;
    let valorLancado = 0;
    const notasEspeciais: number[] = [];

    resultado.categorias.forEach((categoria) => {
      categoria.avaliacoes.forEach((avaliacao) => {
        if (isAvaliacaoDeResumo(categoria.nome, avaliacao.nome)) return;
        const nota = parseNumber(avaliacao.nota);
        const valor = parseNumber(avaliacao.valor);

        if (nota !== null && isSpecialEvaluation(categoria.nome, avaliacao.nome)) {
          notasEspeciais.push(nota);
          return;
        }

        if (nota !== null && valor !== null && valor > 0) {
          pontosLancados += nota;
          valorLancado += valor;
        }
      });
    });

    if (notasEspeciais.length > 0 && pontosLancados < 60) {
      return Math.min(Math.max(...notasEspeciais), 60);
    }

    if (valorLancado <= 0) return null;
    return (pontosLancados / valorLancado) * 100;
  }

  function getResumoPontos(resultado?: ResultadoAvaliacoes) {
    if (!resultado) return null;

    let lancadosRegulares = 0;
    const notasEspeciais: number[] = [];
    const pendenteCalculado = resultado.categorias.reduce((total, categoria) => {
      return total + categoria.avaliacoes.reduce((subtotal, avaliacao) => {
        const nota = parseNumber(avaliacao.nota);
        const valor = parseNumber(avaliacao.valor);
        const isEspecial = isSpecialEvaluation(categoria.nome, avaliacao.nome);

        if (nota !== null) {
          if (isEspecial) {
            notasEspeciais.push(nota);
          } else {
            lancadosRegulares += nota;
          }
          return subtotal;
        }

        if (isEspecial) {
          return subtotal;
        }

        if (valor === null || valor <= 0) {
          return subtotal;
        }

        return subtotal + valor;
      }, 0);
    }, 0);
    const notaEspecial = notasEspeciais.length > 0 ? Math.max(...notasEspeciais) : null;
    const deveUsarEspecial = notaEspecial !== null && lancadosRegulares < resultado.mediaParaAprovacao;
    const lancados = deveUsarEspecial
      ? Math.min(notaEspecial, 60)
      : lancadosRegulares;
    const pendenteTotal = deveUsarEspecial ? 0 : pendenteCalculado;
    const necessario = Math.min(Math.max(resultado.mediaParaAprovacao - lancados, 0), pendenteTotal);
    const pendenteLivre = Math.max(pendenteTotal - necessario, 0);
    const escala = TOTAL_PONTOS;

    return {
      lancados,
      necessario,
      pendenteLivre,
      pendenteTotal,
      escala,
      lancadosPct: clampPercent((lancados / escala) * 100),
      necessarioPct: clampPercent((necessario / escala) * 100),
      pendenteLivrePct: clampPercent((pendenteLivre / escala) * 100),
    };
  }

  const disciplinasComResultado = disciplinas.filter((disciplina) => disciplina.resultado);
  const aproveitamentosLancados = disciplinasComResultado
    .map((disciplina) => disciplina.resultado ? getAproveitamentoLancado(disciplina.resultado) : null)
    .filter((aproveitamento): aproveitamento is number => aproveitamento !== null);
  const mediaGeralLancada = aproveitamentosLancados.length > 0
    ? aproveitamentosLancados.reduce((total, aproveitamento) => total + aproveitamento, 0) / aproveitamentosLancados.length
    : 0;
  const launchProgress = calculateEvaluationLaunchProgress(
    disciplinasComResultado.flatMap((disciplina) => disciplina.resultado?.categorias ?? [])
  );
  const totalAvaliacoes = launchProgress.total;
  const avaliacoesLancadas = launchProgress.launched;
  const statusCounts = disciplinasComResultado.reduce(
    (counts, disciplina) => {
      if (!disciplina.resultado) return counts;
      const status = getStatusFromResultado(disciplina.resultado);
      counts[status] += 1;
      return counts;
    },
    { aprovado: 0, pendente: 0, reprovado: 0 }
  );
  const progressoLancamentos = launchProgress.percentage;
  const metricas = [
    {
      label: 'Média geral',
      value: `${formatNumber(mediaGeralLancada)}%`,
      detail: 'aproveitamento das notas lançadas',
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500',
      bg: 'bg-emerald-500/10',
      progress: mediaGeralLancada,
    },
    {
      label: 'Notas lançadas',
      value: `${avaliacoesLancadas}/${totalAvaliacoes}`,
      detail: `${formatNumber(progressoLancamentos, 0)}% preenchido`,
      icon: Layers,
      color: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500',
      bg: 'bg-emerald-500/10',
      progress: progressoLancamentos,
    },
    {
      label: 'Na média',
      value: `${statusCounts.aprovado}/${disciplinasComResultado.length}`,
      detail: `${statusCounts.pendente} pendentes`,
      icon: CheckCircle,
      color: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500',
      bg: 'bg-emerald-500/10',
      progress: disciplinasComResultado.length > 0 ? (statusCounts.aprovado / disciplinasComResultado.length) * 100 : 0,
    },
  ];
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
    return <PageLoading message="Carregando avaliações..." />;
  }

  if (error && !disciplinasData) {
    return <ApiError error={error} retry={() => refetch()} />;
  }

  if (disciplinas.length === 0) {
    return <EmptyState title="Nenhuma avaliação" description="Nenhuma informação de avaliações disponível." icon="clipboard" retry={() => refetch()} />;
  }

  return (
    <PageTransition className="app-page">
      {(error && disciplinasData) || disciplinasData?.__cacheStale || fetchStatus === 'paused' ? (
        <TotvsOfflineBanner updatedAt={disciplinasData?.__cacheStale ? undefined : dataUpdatedAt} onRetry={() => void refetch()} />
      ) : null}
      <PageHeading
        icon={Star}
        title="Avaliações"
        meta={lastUpdatedLabel ? <span className="inline-flex items-center gap-1.5">Atualizado {lastUpdatedLabel}{isFetching ? <RefreshCw className="size-3.5 animate-spin text-primary" /> : null}</span> : undefined}
        actions={<Button variant="outline" size="icon" onClick={handleRefresh} disabled={isFetching} aria-label="Atualizar" className="hidden sm:inline-flex"><RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} /></Button>}
        desktopActionsOnly
      />

      <Stagger className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {metricas.map((metrica) => {
          return (
            <StaggerItem key={metrica.label}>
              <MetricCard compact icon={metrica.icon} label={metrica.label} value={metrica.value} detail={metrica.detail} progress={metrica.progress} progressClassName={metrica.bar} />
            </StaggerItem>
          );
        })}
      </Stagger>

      {/* Lista de Disciplinas */}
      <section aria-label="Disciplinas" className="academic-stack">
        {disciplinasOrdenadas.map((disciplina) => {
          const resultado = disciplina.resultado;
          const status = resultado
            ? getStatusFromResultado(resultado)
            : null;

          const statusConfig = {
            aprovado: {
              color: 'text-emerald-600 dark:text-emerald-400',
              bg: 'bg-emerald-500/10',
              border: 'border-emerald-500/20'
            },
            pendente: {
              color: 'text-amber-600 dark:text-amber-400',
              bg: 'bg-amber-500/10',
              border: 'border-amber-500/20'
            },
            reprovado: {
              color: 'text-red-600 dark:text-red-400',
              bg: 'bg-red-500/10',
              border: 'border-red-500/20'
            }
          };

          const currentStatus = status ? statusConfig[status] : null;
          const resumoPontos = getResumoPontos(resultado);
          const somatorioDisciplina = resumoPontos?.lancados;
          const isExpanded = expandedCodigo === disciplina.codigo;

          return (
            <AcademicPanel
              key={disciplina.codigo}
              expanded={isExpanded}
            >
              {/* Header da Disciplina */}
              <button
                type="button"
                onClick={() => toggleDisciplina(disciplina.codigo)}
                className="w-full min-h-16 p-4 text-left transition-colors motion-reduce:transition-none hover:bg-gray-50/80 dark:hover:bg-white/[0.025] sm:px-5"
                aria-expanded={isExpanded}
                aria-controls={`avaliacoes-${disciplina.codigo}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold leading-snug text-gray-950 dark:text-white sm:text-base">
                      {disciplina.nome}
                    </h3>
                    {status ? (
                      <p className={`mt-1 text-xs font-semibold ${currentStatus?.color}`}>
                        {status === 'aprovado' ? 'Na média' : status === 'pendente' ? 'Com notas pendentes' : 'Abaixo da média'}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {somatorioDisciplina !== undefined ? (
                      <div className="text-right">
                        <p className={`text-2xl font-extrabold leading-none tabular-nums ${currentStatus?.color || 'text-gray-900 dark:text-white'}`}>
                          {formatNumber(somatorioDisciplina)}
                        </p>
                        <p className="mt-1 text-[10px] font-medium text-gray-400">pontos</p>
                      </div>
                    ) : <GraduationCap className="size-5 text-primary" />}
                    <ChevronDown className={`size-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {resumoPontos && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                      <span><strong className="font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(resumoPontos.lancados)}</strong> lançados</span>
                      <span className="text-right"><strong className="font-semibold text-amber-600 dark:text-amber-400">{formatNumber(resumoPontos.necessario)}</strong> necessários · {formatNumber(resumoPontos.pendenteTotal)} pendentes</span>
                    </div>
                    <AnimatedSegmentedProgress
                      ariaLabel={`${formatNumber(resumoPontos.lancadosPct)}% lançado, ${formatNumber(resumoPontos.necessarioPct)}% necessário e ${formatNumber(resumoPontos.pendenteLivrePct)}% pendente`}
                      className="h-1.5 bg-gray-100 dark:bg-gray-700"
                      segments={[
                        { label: 'Lançado', value: resumoPontos.lancadosPct, className: 'bg-emerald-500' },
                        { label: 'Necessário', value: resumoPontos.necessarioPct, className: 'bg-amber-500' },
                        { label: 'Pendente', value: resumoPontos.pendenteLivrePct, className: 'bg-gray-300 dark:bg-gray-600' },
                      ]}
                    />
                  </div>
                )}
              </button>

              {/* Conteúdo Expandido */}
              {isExpanded && (
                  <div id={`avaliacoes-${disciplina.codigo}`} className="detail-reveal overflow-hidden motion-reduce:transition-none">
                    <div className="academic-panel-body">
                  {disciplina.error && (!resultado || resultado.categorias.length === 0) ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {disciplina.error}
                      </p>
                      <button
                        onClick={handleRefresh}
                        className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  ) : resultado && resultado.categorias.length > 0 ? (
                    <div className="px-4 sm:px-5">
                      {resumoPontos && (
                        <div className="grid grid-cols-3 divide-x divide-gray-200/75 border-b border-gray-200/75 py-4 text-center dark:divide-white/[0.065] dark:border-white/[0.065]">
                          <div className="px-2"><strong className={`block text-xl font-extrabold tabular-nums ${currentStatus?.color || 'text-gray-900 dark:text-white'}`}>{formatNumber(resumoPontos.lancados)}</strong><span className="text-[11px] text-gray-500 dark:text-gray-400">Total lançado</span></div>
                          <div className="px-2"><strong className="block text-xl font-extrabold tabular-nums text-gray-900 dark:text-white">{resultado.mediaParaAprovacao}</strong><span className="text-[11px] text-gray-500 dark:text-gray-400">Meta</span></div>
                          <div className="px-2"><strong className="block text-xl font-extrabold tabular-nums text-gray-900 dark:text-white">{formatNumber(resumoPontos.pendenteTotal)}</strong><span className="text-[11px] text-gray-500 dark:text-gray-400">Em aberto</span></div>
                        </div>
                      )}

                      {/* Categorias */}
                      <div className="divide-y divide-gray-200/75 dark:divide-white/[0.065]">
                        {resultado.categorias.map((categoria) => {
                          const CatIcon = getCategoriaIcon(categoria.nome);
                          const catStyle = getCategoriaStyle(categoria.nome);

                          return (
                            <section key={categoria.nome} className="py-4">
                              {/* Header da Categoria */}
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <CatIcon className={`w-4 h-4 ${catStyle.text}`} />
                                  <span className={`text-sm font-semibold ${catStyle.text}`}>{categoria.nome}</span>
                                </div>
                                {categoria.valorTotal! > 0 && (
                                  <div className="text-right">
                                    <span className={`text-sm font-bold ${catStyle.text}`}>
                                      {categoria.notaTotal?.toFixed(1).replace('.', ',') || '0'}/{categoria.valorTotal?.toFixed(1).replace('.', ',') || '0'}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Avaliações */}
                              <div className="divide-y divide-gray-200/65 dark:divide-white/[0.055]">
                                {categoria.avaliacoes.map((avaliacao, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between py-3"
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
                                        const notaLancada = hasNotaLancada(avaliacao.nota);
                                        if (notaLancada && avaliacao.valor) {
                                          const notaNum = parseFloat((avaliacao.nota ?? '').replace(',', '.'));
                                          const valorNum = parseFloat(avaliacao.valor.replace(',', '.'));
                                          if (!isNaN(notaNum) && !isNaN(valorNum) && valorNum > 0) {
                                            const porcentagem = (notaNum / valorNum) * 100;
                                            notaColor = porcentagem < 60
                                              ? 'text-red-600 dark:text-red-400'
                                              : 'text-emerald-600 dark:text-emerald-400';
                                          }
                                        }
                                        return (
                                          <span className={`text-base font-bold min-w-[2rem] text-right ${notaLancada
                                            ? notaColor
                                            : 'text-gray-400 dark:text-gray-600'
                                          }`}>
                                            {notaLancada ? avaliacao.nota : '-'}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                      {(() => {
                        const mediaParaAprovacao = resultado.mediaParaAprovacao ?? 60;
                        const resumo = getResumoPontos(resultado);
                        const pontosNecessarios = resumo?.necessario ?? 0;
                        const pontosRestantes = resumo?.pendenteTotal ?? 0;
                        const percentNecessario = pontosRestantes > 0
                          ? (pontosNecessarios / pontosRestantes) * 100
                          : 0;

                        return (
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200/75 py-4 text-xs text-emerald-700 dark:border-white/[0.065] dark:text-emerald-300">
                            <span className="font-medium">
                              Necessário {formatNumber(pontosNecessarios)} pontos em {formatNumber(pontosRestantes)} restantes ({formatNumber(percentNecessario)}%)
                            </span>
                            {pontosRestantes === 0 && pontosNecessarios > 0 ? (
                              <span className="text-amber-700 dark:text-amber-300">Sem pontos restantes</span>
                            ) : (
                              <span className="text-emerald-700/80 dark:text-emerald-300/80">
                                Média para aprovação: {mediaParaAprovacao} pontos
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhuma avaliação registrada
                    </div>
                  )}
                </div>
                  </div>
                )}
            </AcademicPanel>
          );
        })}
      </section>
      <PullToRefresh onRefresh={handleRefresh} />
    </PageTransition>
  );
}
