/**
 * Adaptador que converte dados do TOTVS (Aula) para o formato do event-calendar
 * Todas as datas são interpretadas no timezone local (America/Sao_Paulo)
 */

import { Aula } from '@/types/calendario';
import { CalendarEvent, EventColor } from '@/components/event-calendar';
import { addDays, startOfDay } from 'date-fns';

/**
 * Parseia data ISO no timezone local (evita problemas de UTC)
 * Entrada: "2025-08-04" -> Saída: Date 2025-08-04 00:00:00 LOCAL
 */
function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  // month é 0-indexed em JavaScript
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Cores para disciplinas - mapeia hash do nome da disciplina para uma cor
 */
function getColorForDisciplina(disciplina: string): EventColor {
  const colors: EventColor[] = ['green', 'sky', 'amber', 'violet', 'rose', 'orange'];

  // Hash simples baseado no nome da disciplina
  let hash = 0;
  for (let i = 0; i < disciplina.length; i++) {
    hash = disciplina.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Converte uma Aula do TOTVS em um CalendarEvent do event-calendar
 */
export function aulaToCalendarEvent(aula: Aula, eventId: string): CalendarEvent {
  // Tenta usar a data_inicial_iso do HTML, senão calcula a próxima ocorrência
  let baseData: Date;

  if (aula.data_inicial_iso) {
    // Usa a data real do HTML (ex: "2025-08-04") no timezone local
    baseData = parseLocalDate(aula.data_inicial_iso);
  } else {
    // Fallback: calcula próxima ocorrência (comportamento antigo)
    const hoje = new Date();
    const targetDay = aula.dia_num === 7 ? 0 : aula.dia_num;
    const currentDay = hoje.getDay();
    let daysToAdd = targetDay - currentDay;

    if (daysToAdd < 0) {
      daysToAdd += 7;
    } else if (daysToAdd === 0) {
      const agora = new Date();
      const [horaIni] = aula.inicio.split(':').map(Number);
      const [horaFim, minFim] = aula.fim.split(':').map(Number);
      const horaAtual = agora.getHours() * 60 + agora.getMinutes();
      const horaFimAula = horaFim * 60 + minFim;

      if (horaFimAula < horaAtual) {
        daysToAdd = 7;
      }
    }

    baseData = addDays(startOfDay(hoje), daysToAdd);
  }

  // Parseia horários (formato: "HH:MM")
  const [horaIni, minIni] = aula.inicio.split(':').map(Number);
  const [horaFim, minFim] = aula.fim.split(':').map(Number);

  const start = new Date(baseData);
  start.setHours(horaIni, minIni, 0, 0);

  const end = new Date(baseData);
  end.setHours(horaFim, minFim, 0, 0);

  // Monta descrição com detalhes da aula (sem emoji)
  const description = [
    aula.sala ? `Sala: ${aula.sala}` : '',
    aula.predio ? `Predio: ${aula.predio}` : '',
    aula.bloco ? `Bloco: ${aula.bloco}` : '',
    aula.turma ? `Turma: ${aula.turma}` : '',
    aula.subturma ? `Subturma: ${aula.subturma}` : '',
    aula.tipo_turma ? `Tipo: ${aula.tipo_turma}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Monta location
  const locationParts = [
    aula.sala,
    aula.predio,
    aula.bloco,
  ].filter(Boolean);

  const location = locationParts.length > 0
    ? locationParts.join(' - ')
    : undefined;

  return {
    id: eventId,
    start: start,
    end: end,
    title: aula.disciplina || 'Aula',
    color: getColorForDisciplina(aula.disciplina),
    description: description || 'Sem informações adicionais',
    location,
    allDay: false,
    detalheId: aula.detalhe_id || undefined,
  };
}

/**
 * Converte array de Aulas em array de CalendarEvents, removendo duplicatas
 */
export function aulasToCalendarEvents(aulas: Aula[]): CalendarEvent[] {
  
  // Agrupa aulas por chave única para evitar duplicatas
  // A chave agora inclui a data para garantir que aulas em datas diferentes não sejam consideradas duplicatas
  const aulasUnicas = new Map<string, Aula>();

  aulas.forEach((aula) => {
    if (!aula.inicio || !aula.fim || !aula.dia_num) {
            return;
    }

    // Usa a data_inicial_iso se disponível, senão apenas dia_num + horário
    const chave = aula.data_inicial_iso
      ? `${aula.data_inicial_iso}-${aula.inicio}-${aula.fim}-${aula.disciplina}`
      : `${aula.dia_num}-${aula.inicio}-${aula.fim}-${aula.disciplina}`;

    if (!aulasUnicas.has(chave)) {
      aulasUnicas.set(chave, aula);
    }
  });

  
  // Converte para CalendarEvent
  let eventIdCounter = 0;
  const events: CalendarEvent[] = [];

  aulasUnicas.forEach((aula) => {
    const event = aulaToCalendarEvent(aula, `aula-${eventIdCounter++}`);
    events.push(event);
  });

  
  return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
