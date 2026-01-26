/**
 * Parser de HTML de Detalhes do TOTVS EduConnect
 * Extrai informações do detalhe da aula (professor, localização, etc.)
 */

import * as cheerio from 'cheerio';

export interface DetalheAula {
  horario?: string;
  codigo_disciplina?: string;
  nome_disciplina?: string;
  data_inicial?: string;
  data_final?: string;
  turma?: string;
  subturma?: string;
  tipo_turma?: string;
  professores: string[];
  predio?: string;
  bloco?: string;
  sala?: string;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parseia o HTML de detalhe da aula e extrai as informações
 */
export function parseDetalheHTML(html: string): DetalheAula {
  const $ = cheerio.load(html);
  const result: DetalheAula = {
    professores: [],
  };

  // Helper para extrair valor de um campo display-label/display-field
  const extractField = (label: string): string | undefined => {
    const labelElement = $('div.display-label').filter((_, el) => {
      return $(el).text().includes(label);
    });

    if (labelElement.length === 0) return undefined;

    const valueElement = labelElement.next('div.display-field, div.display-label');
    if (valueElement.length > 0) {
      return decodeHTMLEntities(valueElement.text());
    }

    return undefined;
  };

  // Extrair campos básicos
  result.horario = extractField('Horário');
  result.codigo_disciplina = extractField('Cód. disciplina');
  result.nome_disciplina = extractField('Nome disciplina');
  result.data_inicial = extractField('Data inicial');
  result.data_final = extractField('Data final');
  result.turma = extractField('Turma');
  result.subturma = extractField('Subturma');
  result.tipo_turma = extractField('Tipo turma');

  // Extrair professores do fieldset "Professor(es)"
  const professorFieldset = $('fieldset legend').filter((_, el) => {
    return $(el).text().includes('Professor');
  }).parent('fieldset');

  if (professorFieldset.length > 0) {
    professorFieldset.find('ul[data-role="listview"] li').each((_, li) => {
      const nome = decodeHTMLEntities($(li).text());
      if (nome) {
        result.professores.push(nome);
      }
    });
  }

  // Extrair localização
  const localizacaoFieldset = $('fieldset legend').filter((_, el) => {
    return $(el).text().includes('Localiza');
  }).parent('fieldset');

  if (localizacaoFieldset.length > 0) {
    result.predio = extractField('Prédio');
    result.bloco = extractField('Bloco');
    result.sala = extractField('Sala');
  }

  return result;
}
