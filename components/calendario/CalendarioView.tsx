'use client';

import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, subMonths, addWeeks, subWeeks, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { EventoHorario } from '@/types/calendario';

const locales = {
  'pt-BR': ptBR,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

interface CalendarioViewProps {
  eventos: EventoHorario[];
  onEventClick: (evento: EventoHorario) => void;
}

export function CalendarioView({ eventos, onEventClick }: CalendarioViewProps) {
  const [view, setView] = useState<View>('week');
  const [date, setDate] = useState(new Date());

  const handleSelectEvent = useCallback(
    (event: EventoHorario) => {
      onEventClick(event);
    },
    [onEventClick]
  );

  const handlePrevious = () => {
    if (view === 'month') {
      setDate(subMonths(date, 1));
    } else if (view === 'week') {
      setDate(subWeeks(date, 1));
    } else if (view === 'day') {
      setDate(addDays(date, -1));
    } else if (view === 'agenda') {
      setDate(addDays(date, -30));
    }
  };

  const handleNext = () => {
    if (view === 'month') {
      setDate(addMonths(date, 1));
    } else if (view === 'week') {
      setDate(addWeeks(date, 1));
    } else if (view === 'day') {
      setDate(addDays(date, 1));
    } else if (view === 'agenda') {
      setDate(addDays(date, 30));
    }
  };

  const handleToday = () => {
    setDate(new Date());
  };

  const viewTitle = useMemo(() => {
    if (view === 'month') {
      return format(date, "MMMM 'de' yyyy", { locale: ptBR });
    } else if (view === 'week') {
      return format(date, "MMMM 'de' yyyy", { locale: ptBR });
    } else if (view === 'day') {
      return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    } else if (view === 'agenda') {
      return format(date, "MMMM 'de' yyyy", { locale: ptBR });
    }
    return '';
  }, [date, view]);

  const formats = useMemo(
    () => ({
      timeGutterFormat: 'HH:mm',
      eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
        `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
      agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
        `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
      agendaDateFormat: (date: Date) => format(date, 'dd/MM'),
      dayFormat: (date: Date) => format(date, 'EEE dd', { locale: ptBR }),
      dayHeaderFormat: (date: Date) => format(date, 'EEEE, dd/MM', { locale: ptBR }),
    }),
    []
  );

  // Componente customizado para eventos - Estilo Google Agenda
  const EventComponent = useCallback(({ event }: { event: EventoHorario }) => {
    const timeRange = `${format(event.start, 'HH:mm')} - ${format(event.end, 'HH:mm')}`;

    return (
      <div style={{
        color: 'white',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '2px'
      }}>
        <div style={{
          fontWeight: 600,
          fontSize: '12px',
          lineHeight: '16px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-word'
        }}>
          {event.title}
        </div>
        <div style={{
          fontSize: '11px',
          lineHeight: '14px',
          opacity: 0.9,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {timeRange}
        </div>
      </div>
    );
  }, []);

  const components = useMemo(
    () => ({
      event: EventComponent,
    }),
    [EventComponent]
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      {/* Toolbar customizada */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
        <div className="flex items-center gap-4">
          <button
            onClick={handleToday}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <CalendarIcon className="inline-block mr-2 h-4 w-4" />
            Hoje
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={handleNext}
              className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Próximo"
            >
              <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
            {viewTitle}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'month'
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Mês
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'week'
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setView('day')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'day'
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Dia
          </button>
          <button
            onClick={() => setView('agenda')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'agenda'
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Agenda
          </button>
        </div>
      </div>

      {/* Calendário */}
      <div className="p-4">
        <div className="h-[600px]">
          <Calendar
            localizer={localizer}
            events={eventos}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            onSelectEvent={handleSelectEvent}
            formats={formats}
            components={components}
            toolbar={false}
            messages={{
              next: 'Próximo',
              previous: 'Anterior',
              today: 'Hoje',
              month: 'Mês',
              week: 'Semana',
              day: 'Dia',
              agenda: 'Agenda',
              date: 'Data',
              time: 'Hora',
              event: 'Evento',
              noEventsInRange: 'Não há aulas neste período',
              showMore: (total) => `+ ${total} mais`,
            }}
            min={new Date(2024, 0, 1, 7, 0, 0)}
            max={new Date(2024, 0, 1, 22, 0, 0)}
            culture="pt-BR"
          />
        </div>
      </div>
    </div>
  );
}
