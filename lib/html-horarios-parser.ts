/**
 * Parser de HTML do TOTVS EduConnect - Quadro de Horários
 * Extrai aulas estruturadas do HTML (replicação da lógica do extract_horarios.py)
 */

import * as cheerio from 'cheerio';
import { Aula } from '@/types/calendario';

const BASE_URL = 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br';

/**
 * Converte data DD/MM/YYYY para ISO (YYYY-MM-DD)
 */
function isoFromDDMMYYYY(dateStr: string): string {
  const trimmed = (dateStr || '').trim();
  if (!trimmed) return '';

  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';

  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Limpa texto (remove HTML entities, normaliza espaços)
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converte href relativo em URL absoluto
 */
function absoluteUrl(href: string): string {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  return `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
}

/**
 * Parseia o HTML do quadro de horários e extrai todas as aulas
 */
export function parseHorariosHTML(html: string): Aula[] {
  const $ = cheerio.load(html);
  const aulas: Aula[] = [];

  // Mapeia os dias da semana pelos cabeçalhos th[id^=tdDia_]
  const dayMap: Record<number, string> = {};
  $('th[id^=tdDia_]').each((_, th) => {
    const id = $(th).attr('id');
    if (!id) return;

    const match = id.match(/tdDia_(\d+)/);
    if (match) {
      const dayNum = parseInt(match[1], 10);
      dayMap[dayNum] = cleanText($(th).text());
    }
  });

  
  // Para cada dia (1-7), procura ul com id="dvDia_{n}"
  for (let n = 1; n <= 7; n++) {
    const ul = $(`ul#dvDia_${n}`);
    if (ul.length === 0) continue;

    // Para cada li (aula) dentro do ul
    ul.find('li').each((_, li) => {
      const a = $(li).find('a').first();
      if (a.length === 0) return;

      const text = a.text();
      if (text.includes('Nenhum registro encontrado')) return;

      // Extrai href e monta detalhe_url
      const href = a.attr('href') || '';
      const detalheUrl = absoluteUrl(href);

      // Extrai detalhe_id do href (ex: /EduQuadroHorarioAlunoDetalhe/2922575)
      const idMatch = href.match(/\/EduQuadroHorarioAlunoDetalhe\/(\d+)/);
      const detalheId = idMatch ? idMatch[1] : '';

      // Extrai horário início e fim do .ui-block-a
      let inicio = '';
      let fim = '';
      const blockA = a.find('.ui-block-a');
      if (blockA.length > 0) {
        const parts = cleanText(blockA.text()).split(/\s+/);
        if (parts.length > 0) {
          inicio = parts[0];
          fim = parts.length >= 2 ? parts[parts.length - 1] : '';
        }
      }

      // Extrai disciplina do h2
      const h2 = a.find('h2');
      const disciplina = h2.length > 0 ? cleanText(h2.text()) : '';

      // Extrai detalhes dos <p> com <strong>
      const details: Record<string, string> = {};
      a.find('p').each((_, p) => {
        const strong = $(p).find('strong');
        if (strong.length === 0) return;

        const label = cleanText(strong.text()).replace(/:$/, '');
        strong.remove();
        const value = cleanText($(p).text());
        details[label] = value;
      });

      const dataInicial = details['Data inicial'] || '';
      const dataFinal = details['Data final'] || '';

      aulas.push({
        dia_num: n,
        dia: dayMap[n] || '',
        inicio,
        fim,
        disciplina,
        turma: details['Turma'] || '',
        subturma: details['Subturma'] || '',
        data_inicial: dataInicial,
        data_inicial_iso: isoFromDDMMYYYY(dataInicial),
        data_final: dataFinal,
        data_final_iso: isoFromDDMMYYYY(dataFinal),
        predio: details['Prédio'] || '',
        bloco: details['Bloco'] || '',
        sala: details['Sala'] || '',
        tipo_turma: details['Tipo turma'] || '',
        detalhe_id: detalheId,
        detalhe_url: detalheUrl,
        raw_details: details,
      });
    });
  }

    return aulas;
}
