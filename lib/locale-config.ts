/**
 * Configurações de localização e fuso horário para o Brasil
 */

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Fuso horário de São Paulo
export const TIMEZONE = 'America/Sao_Paulo';

// Localidade brasileira
export const LOCALE = ptBR;

/**
 * Formata uma data para exibição em português
 */
export function formatDate(date: Date, formatStr: string): string {
  return format(date, formatStr, { locale: LOCALE });
}

/**
 * Nomes dos dias da semana abreviados (Dom, Seg, Ter, Qua, Qui, Sex, Sáb)
 */
export const WEEKDAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Nomes dos dias da semana completos
 */
export const WEEKDAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Nomes dos meses abreviados
 */
export const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Nomes dos meses completos
 */
export const MONTH_NAMES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * Labels traduzidos para o calendário
 */
export const CALENDAR_LABELS = {
  today: 'Hoje',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  newEvent: 'Novo evento',
  allDay: 'Dia inteiro',
  title: 'Título',
  description: 'Descrição',
  startDate: 'Data inicial',
  endDate: 'Data final',
  startTime: 'Horário inicial',
  endTime: 'Horário final',
  location: 'Local',
  color: 'Cor',
  save: 'Salvar',
  cancel: 'Cancelar',
  delete: 'Excluir',
  editEvent: 'Editar evento',
  createEvent: 'Criar evento',
  noEventsFound: 'Nenhum evento encontrado',
  noEventsScheduled: 'Não há eventos agendados para este período.',
  pickDate: 'Escolher data',
  selectTime: 'Selecionar horário',
  eventAdded: 'Evento adicionado',
  eventUpdated: 'Evento atualizado',
  eventDeleted: 'Evento excluído',
  eventMoved: 'Evento movido',
  more: 'mais',
  noTitle: '(sem título)',
} as const;
