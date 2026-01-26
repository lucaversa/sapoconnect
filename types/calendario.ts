/**
 * Formato de aula extraído do HTML do TOTVS EduConnect
 */
export interface Aula {
  dia_num: number;
  dia: string;
  inicio: string;
  fim: string;
  disciplina: string;
  turma: string;
  subturma: string;
  data_inicial: string;
  data_inicial_iso: string;
  data_final: string;
  data_final_iso: string;
  predio: string;
  bloco: string;
  sala: string;
  tipo_turma: string;
  detalhe_id: string;
  detalhe_url: string;
  raw_details: Record<string, string>;
}

/**
 * Resposta da API de horários
 */
export interface HorarioResponse {
  aulas: Aula[];
}

export interface EventoHorario {
  title: string;
  start: Date;
  end: Date;
  extendedProps: {
    predio: string;
    bloco: string;
    sala: string;
    turma: string;
    subturma: string;
    codDisc: string;
  };
}
