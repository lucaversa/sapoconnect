'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon, RefreshCw, Sun, CalendarDays, Download, ArrowUpRight } from 'lucide-react';
import {
  format,
  formatDistanceToNow,
  isAfter,
  isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  EventCalendar,
  EventViewDialog,
  CalendarEvent,
} from '@/components/event-calendar';
import { HorarioResponse } from '@/types/calendario';
import { aulasToCalendarEvents } from '@/lib/event-calendar-adapter';
import { exportCalendarioToPDF } from '@/lib/calendar-export';
import { PageLoading } from '@/components/page-loading';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { ApiError } from '@/components/api-error';
import { EmptyState } from '@/components/empty-state';
import { TotvsOfflineBanner } from '@/components/totvs-offline-banner';
import { useHorario } from '@/hooks/use-horario';
import { useUserInfo } from '@/hooks/use-user-info';
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

export default function CalendarioPage() {
  const { data, error, isLoading, isFetching, refetch, dataUpdatedAt } = useHorario();
  const { ra } = useUserInfo();
  const [isExporting, setIsExporting] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);

  const handleRefresh = async () => {
    const toastId = toast.loading('Atualizando...', { id: 'refresh-calendar' });
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

  const handleExportPDF = async () => {
    if (!data?.aulas || data.aulas.length === 0) {
      toast.error('Não há aulas para exportar.');
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading('Gerando PDF...');

    try {
      await exportCalendarioToPDF(data.aulas, ra);
      toast.success('PDF gerado com sucesso!', { id: toastId });
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.error('Erro ao gerar PDF. Tente novamente.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  function encontrarProximaAula(): CalendarEvent | null {
    if (!data?.aulas) return null;
    const eventos = aulasToCalendarEvents(data.aulas);
    const agora = new Date();
    const aulasFuturas = eventos.filter((evento) => isAfter(new Date(evento.start), agora));
    return aulasFuturas[0] || null;
  }

  function encontrarProximoSabado(): CalendarEvent | null {
    if (!data?.aulas) return null;
    const eventos = aulasToCalendarEvents(data.aulas);
    const agora = new Date();
    const sabadosFuturos = eventos.filter((evento) => {
      const eventDate = new Date(evento.start);
      return isAfter(eventDate, agora) && eventDate.getDay() === 6;
    });
    return sabadosFuturos[0] || null;
  }

  const isOffline = isTotvsOfflineError(error);

  if (isLoading) {
    return <PageLoading message="Carregando calendário..." />;
  }

  if (error && !data) {
    return <ApiError error={error} retry={() => refetch()} />;
  }

  if (!data?.aulas?.length) {
    return <EmptyState title="Nenhum horário encontrado" description="Não há aulas cadastradas para exibir." icon="calendar" retry={() => refetch()} />;
  }

  const eventos = aulasToCalendarEvents(data.aulas);
  const proximaAula = encontrarProximaAula();
  const proximoSabado = encontrarProximoSabado();
  const aulasHojeCount = eventos.filter((evento) =>
    isSameDay(new Date(evento.start), new Date())
  ).length;
  const lastUpdatedLabel = dataUpdatedAt
    ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: ptBR })
    : null;

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
              Horários
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Visualize sua grade horária e próximas atividades
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              {lastUpdatedLabel && (
                <span>Atualizado {lastUpdatedLabel}</span>
              )}
              {isFetching && data?.aulas?.length ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Atualizando dados...
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExporting || isLoading || !data?.aulas?.length}
              className="flex items-center justify-center w-10 h-10 text-gray-500 border border-gray-200 rounded-lg dark:border-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              aria-label="Exportar PDF"
              title="Exportar horário para PDF"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} />
            </button>
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className="hidden sm:flex items-center justify-center w-10 h-10 text-gray-500 border border-gray-200 rounded-lg dark:border-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              aria-label="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {/* Próxima Aula */}
          <button
            type="button"
            onClick={() => {
              if (!proximaAula) return;
              setSelectedEvent(proximaAula);
              setIsEventDialogOpen(true);
            }}
            disabled={!proximaAula}
            className="group h-full bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 disabled:cursor-default disabled:opacity-75 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10"
            aria-label={proximaAula ? 'Abrir detalhes da próxima aula' : 'Nenhuma próxima aula'}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <CalendarIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Próxima Aula</p>
                {proximaAula ? (
                  <>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate mt-0.5">
                      {proximaAula.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {format(new Date(proximaAula.start), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 mt-0.5">Nenhuma programada</p>
                )}
              </div>
              {proximaAula && (
                <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600/80 dark:text-emerald-400/80">
                  Detalhes
                  <ArrowUpRight className="h-3 w-3" />
                </div>
              )}
            </div>
          </button>

          {/* Próximo Sábado Letivo */}
          <button
            type="button"
            onClick={() => {
              if (!proximoSabado) return;
              setSelectedEvent(proximoSabado);
              setIsEventDialogOpen(true);
            }}
            disabled={!proximoSabado}
            className="group h-full bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 disabled:cursor-default disabled:opacity-75 hover:bg-amber-50/40 dark:hover:bg-amber-900/10"
            aria-label={proximoSabado ? 'Abrir detalhes do próximo sábado letivo' : 'Nenhum sábado letivo programado'}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sun className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Próximo Sábado Letivo</p>
                {proximoSabado ? (
                  <>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate mt-0.5">
                      {proximoSabado.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {format(new Date(proximoSabado.start), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 mt-0.5">Nenhum programado</p>
                )}
              </div>
              {proximoSabado && (
                <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600/80 dark:text-amber-400/80">
                  Detalhes
                  <ArrowUpRight className="h-3 w-3" />
                </div>
              )}
            </div>
          </button>

          {/* Aulas Hoje */}
          <div className="h-full bg-white dark:bg-gray-800 rounded-2xl p-3 sm:p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Aulas Hoje</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-0.5">
                  {aulasHojeCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* EventCalendar Component */}
      <motion.div variants={sectionVariants}>
      <EventCalendar events={eventos} initialView="week" />
      </motion.div>

      <EventViewDialog
        event={selectedEvent}
        isOpen={isEventDialogOpen}
        onClose={() => {
          setIsEventDialogOpen(false);
          setSelectedEvent(null);
        }}
      />
      <PullToRefresh onRefresh={handleRefresh} />
    </motion.div>
  );
}
