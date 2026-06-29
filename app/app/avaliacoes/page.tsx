'use client';

import { useState } from 'react';
import {
  ChevronDown,
  FileText,
  Calendar,
  Award,
  TrendingUp,
  GraduationCap,
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
import { EmptyState } from '@/components/empty-state';
import { ResultadoAvaliacoes, useAvaliacoesCompleto } from '@/hooks/use-avaliacoes';
import { isTotvsOfflineError } from '@/lib/api-response-error';
import { AnimatePresence, motion, type Variants } from 'framer-motion';

const TOTAL_PONTOS = 100;
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

function isAvaliacaoEspecial(categoriaNome: string, avaliacaoNome: string): boolean {
  const normalized = `${normalizeText(categoriaNome)} ${normalizeText(avaliacaoNome)}`;
  return normalized.includes('especial');
}

export default function AvaliacoesPage() {
  const { data: disciplinasData, error, isLoading, isFetching, refetch, dataUpdatedAt } = useAvaliacoesCompleto();

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

  function hasNotaLancada(nota?: string): boolean {
    return parseNumber(nota) !== null;
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

        if (nota !== null && isAvaliacaoEspecial(categoria.nome, avaliacao.nome)) {
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
        const isEspecial = isAvaliacaoEspecial(categoria.nome, avaliacao.nome);

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
  const totalAvaliacoes = disciplinasComResultado.reduce(
    (total, disciplina) => total + (disciplina.resultado?.categorias.reduce(
      (categoriaTotal, categoria) => {
        return categoriaTotal + categoria.avaliacoes.length;
      },
      0
    ) ?? 0),
    0
  );
  const avaliacoesLancadas = disciplinasComResultado.reduce(
    (total, disciplina) => total + (disciplina.resultado?.categorias.reduce(
      (categoriaTotal, categoria) => {
        return categoriaTotal + categoria.avaliacoes.filter((avaliacao) => hasNotaLancada(avaliacao.nota)).length;
      },
      0
    ) ?? 0),
    0
  );
  const statusCounts = disciplinasComResultado.reduce(
    (counts, disciplina) => {
      if (!disciplina.resultado) return counts;
      const status = getStatusFromResultado(disciplina.resultado);
      counts[status] += 1;
      return counts;
    },
    { aprovado: 0, pendente: 0, reprovado: 0 }
  );
  const progressoLancamentos = totalAvaliacoes > 0 ? (avaliacoesLancadas / totalAvaliacoes) * 100 : 0;
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
      color: 'text-blue-600 dark:text-blue-400',
      bar: 'bg-blue-500',
      bg: 'bg-blue-500/10',
      progress: progressoLancamentos,
    },
    {
      label: 'Na média',
      value: `${statusCounts.aprovado}/${disciplinasComResultado.length}`,
      detail: `${statusCounts.pendente} pendentes`,
      icon: CheckCircle,
      color: 'text-teal-600 dark:text-teal-400',
      bar: 'bg-teal-500',
      bg: 'bg-teal-500/10',
      progress: disciplinasComResultado.length > 0 ? (statusCounts.aprovado / disciplinasComResultado.length) * 100 : 0,
    },
  ];
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
    <motion.div
      className="p-4 sm:p-6 space-y-6"
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={sectionVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Avaliações
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Visualize suas notas por disciplina
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {lastUpdatedLabel && (
              <span className="inline-flex items-center gap-1">
                Atualizado {lastUpdatedLabel}
                {isFetching && (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                )}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="hidden sm:flex items-center justify-center w-10 h-10 text-gray-500 border border-gray-200 rounded-lg dark:border-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          aria-label="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      <motion.div variants={sectionVariants} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metricas.map((metrica) => {
          const Icon = metrica.icon;

          return (
            <div
              key={metrica.label}
              className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-4"
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${metrica.bg}`}>
                  <Icon className={`h-4 w-4 ${metrica.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{metrica.label}</p>
                  <p className="mt-0.5 truncate text-lg font-bold text-gray-900 dark:text-white">
                    {metrica.value}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                    {metrica.detail}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <motion.div
                  className={`h-full rounded-full ${metrica.bar}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(Math.max(metrica.progress, 0), 100)}%` }}
                  transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Lista de Disciplinas */}
      <motion.div variants={sectionVariants} className="space-y-3">
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
            <div
              key={disciplina.codigo}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm"
            >
              {/* Header da Disciplina */}
              <button
                onClick={() => toggleDisciplina(disciplina.codigo)}
                className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${currentStatus
                      ? `${currentStatus.bg} ${currentStatus.border} border`
                      : 'bg-gradient-to-br from-purple-500 to-pink-600 shadow-purple-500/20'
                      }`}>
                      {currentStatus && somatorioDisciplina !== undefined ? (
                        <span className={`text-sm font-bold leading-none sm:text-base ${currentStatus.color}`}>
                          {formatNumber(somatorioDisciplina)}
                        </span>
                      ) : (
                        <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                        {disciplina.nome}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''
                        }`}
                    />
                  </div>
                </div>

                {resumoPontos && (
                  <div className="mt-3 pl-0 sm:pl-[60px]">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Lançado {formatNumber(resumoPontos.lancados)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Necessário {formatNumber(resumoPontos.necessario)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                        Pendente {formatNumber(resumoPontos.pendenteTotal)}
                      </span>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <motion.div
                        className="h-full bg-emerald-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${resumoPontos.lancadosPct}%` }}
                        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                      />
                      <motion.div
                        className="h-full bg-amber-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${resumoPontos.necessarioPct}%` }}
                        transition={{ duration: 0.65, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                      />
                      <motion.div
                        className="h-full bg-gray-300 dark:bg-gray-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${resumoPontos.pendenteLivrePct}%` }}
                        transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                )}
              </button>

              {/* Conteúdo Expandido */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key={`avaliacoes-${disciplina.codigo}`}
                    initial={{ height: 0, opacity: 0, y: -4 }}
                    animate={{ height: 'auto', opacity: 1, y: 0 }}
                    exit={{ height: 0, opacity: 0, y: -4 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-gray-100 dark:border-gray-700">
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
                    <div className="p-4 space-y-4">
                      {/* Somatorio das notas lancadas */}
                      {resumoPontos && (
                        <div className={`flex items-center justify-between p-4 rounded-xl border ${currentStatus ? `${currentStatus.bg} ${currentStatus.border}` : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                          }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentStatus ? currentStatus.bg : 'bg-gray-100 dark:bg-gray-800'
                              }`}>
                              <GraduationCap className={`w-5 h-5 ${currentStatus?.color || 'text-gray-600 dark:text-gray-400'}`} />
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${currentStatus?.color || 'text-gray-900 dark:text-white'}`}>
                                Somatório das notas lançadas
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Média para aprovação: {resultado.mediaParaAprovacao} pts
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-bold ${currentStatus?.color || 'text-gray-900 dark:text-white'}`}>
                              {formatNumber(resumoPontos.lancados)}
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
                            </div>
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
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
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
              </motion.div>
            )}
          </AnimatePresence>
            </div>
          );
        })}
      </motion.div>
      <PullToRefresh onRefresh={handleRefresh} />
    </motion.div>
  );
}
