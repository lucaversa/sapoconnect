/**
 * Adaptador que converte dados do TOTVS (Aula) para o formato do calendar-module (IEvent)
 */

import { Aula } from '@/types/calendario';
import { IEvent, IUser } from '@/components/calendar-module/interfaces';
import { addDays, startOfDay } from 'date-fns';

// Usuário padrão (aluno logado)
const DEFAULT_USER: IUser = {
  id: 'aluno-logado',
  name: 'Você',
  picturePath: null,
};

/**
 * Cores para disciplinas - mapeia hash do nome da disciplina para uma cor
 */
function getColorForDisciplina(disciplina: string): 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange' {
  const colors: ('blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange')[] = [
    'blue', 'green', 'red', 'yellow', 'purple', 'orange'
  ];

  // Hash simples baseado no nome da disciplina
  let hash = 0;
  for (let i = 0; i < disciplina.length; i++) {
    hash = disciplina.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Converte uma Aula do TOTVS em um IEvent do calendar-module
 */
export function aulaToEvent(aula: Aula, eventId: number): IEvent {
  // Tenta usar a data_inicial_iso do HTML, senão calcula a próxima ocorrência
  let baseData: Date;

  if (aula.data_inicial_iso) {
    // Usa a data real do HTML (ex: "2025-08-04")
    baseData = new Date(aula.data_inicial_iso);
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

  // Monta descrição com detalhes da aula
  const description = [
    aula.sala ? `📍 Sala: ${aula.sala}` : '',
    aula.predio ? `🏢 Prédio: ${aula.predio}` : '',
    aula.bloco ? `🏗️ Bloco: ${aula.bloco}` : '',
    aula.turma ? `👥 Turma: ${aula.turma}` : '',
    aula.subturma ? `📋 Subturma: ${aula.subturma}` : '',
    aula.tipo_turma ? `📚 Tipo: ${aula.tipo_turma}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: eventId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    title: aula.disciplina || 'Aula',
    color: getColorForDisciplina(aula.disciplina),
    description: description || 'Sem informações adicionais',
    user: DEFAULT_USER,
  };
}

/**
 * Converte array de Aulas em array de IEvents, removendo duplicatas
 */
export function aulasToEvents(aulas: Aula[]): IEvent[] {
  
  // Agrupa aulas por chave única para evitar duplicatas
  const aulasUnicas = new Map<string, Aula>();

  aulas.forEach((aula) => {
    if (!aula.inicio || !aula.fim || !aula.dia_num) {
            return;
    }

    const chave = `${aula.dia_num}-${aula.inicio}-${aula.fim}-${aula.disciplina}`;

    if (!aulasUnicas.has(chave)) {
      aulasUnicas.set(chave, aula);
    }
  });

  
  // Converte para IEvent
  let eventId = 1;
  const events: IEvent[] = [];

  aulasUnicas.forEach((aula) => {
    const event = aulaToEvent(aula, eventId++);
    events.push(event);
  });

  
  return events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}
