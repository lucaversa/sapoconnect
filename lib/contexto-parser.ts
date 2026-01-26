/**
 * Parser de HTML de Seleção de Período Letivo (TOTVS EduConnect)
 *
 * No início de semestre, ao acessar GetContextoAluno, o sistema pode retornar
 * um HTML com múltiplos períodos disponíveis. Este módulo detecta essa situação
 * e extrai as informações necessárias para selecionar automaticamente o período
 * mais novo.
 */

import * as cheerio from 'cheerio';

export interface PeriodoOpcao {
  label: string;           // Ex: "20261 - Medicina|MEDICINA|Turma: M80D626.1 | Período: 6"
  hdKeyTD: string;         // Token criptografado para seleção
  periodoNumero: number;   // Ex: 6 (extraído do label)
}

export interface SelecaoPeriodo {
  periodos: PeriodoOpcao[];
  formAction: string;      // URL para POST
}

/**
 * Detecta se o HTML é a tela de seleção de período
 *
 * Detecta quando:
 * 1. Tem "Selecione um período letivo" (com ou sem HTML entities)
 * 2. Tem form para SetContextoAluno
 * 3. Tem listview com opções de período
 */
export function isTelaSelecaoPeriodo(html: string): boolean {
  // Decodifica HTML entities básicas para verificação
  const decodedHtml = html
    .replace(/&#237;/g, 'í')
    .replace(/&#237;/g, 'í')
    .replace(/&#233;/g, 'é')
    .replace(/&#227;/g, 'ã')
    .replace(/&#245;/g, 'õ')
    .replace(/&#234;/g, 'ê')
    .replace(/&#244;/g, 'â')
    .replace(/&#243;/g, 'ó')
    .replace(/&#225;/g, 'á')
    .replace(/&nbsp;/g, ' ');

  // Verificações para tela de seleção de período
  const hasPeriodoLetivo = decodedHtml.includes('Período Letivo');
  const hasSelecione = decodedHtml.includes('Selecione um período letivo') ||
                        decodedHtml.includes('Selecione um periodo letivo');
  const hasSetContextoForm = html.includes('SetContextoAluno') && html.includes('<form');
  const hasListview = html.includes('data-role="listview"');

  console.log('[CONTEXTO_PARSER] isTelaSelecaoPeriodo:', {
    hasPeriodoLetivo,
    hasSelecione,
    hasSetContextoForm,
    hasListview,
    htmlLength: html.length,
  });

  // É tela de seleção se tiver form SetContextoAluno E listview
  const isSelectionScreen = hasSetContextoForm && hasListview;

  console.log('[CONTEXTO_PARSER] Resultado:', isSelectionScreen);

  return isSelectionScreen;
}

/**
 * Extrai opções de período do HTML de seleção
 *
 * Suporta dois formatos:
 * 1. Formato tradicional com form e SubmitForm
 * 2. Formato com links diretos (<a href>)
 */
export function parseSelecaoPeriodo(html: string): SelecaoPeriodo | null {
  if (!isTelaSelecaoPeriodo(html)) return null;

  const $ = cheerio.load(html);
  const periodos: PeriodoOpcao[] = [];

  // Tenta formato 1: Formulário tradicional
  const form = $('form#frmCtx');
  if (form.length > 0) {
    const formAction = form.attr('action') || '/EducaMobile/Educacional/EduContexto/SetContextoAluno';

    // Encontra todas as opções dentro da listview
    $('ul[data-role="listview"] li a').each((_, el) => {
      const onclick = $(el).attr('onclick');
      if (!onclick) return;

      // Extrai label do primeiro parâmetro (base64_encoded no onclick)
      const match = onclick.match(/SubmitForm\('([^']+)'/);
      if (!match) return;

      const label = decodeURIComponent(match[1]);
      const hdKeyTD = extractHdKeyTD(onclick);

      // Extrai número do período (ex: "Período: 6" -> 6)
      const periodoMatch = label.match(/Per[íi]odo:\s*(\d+)/);
      const periodoNumero = periodoMatch ? parseInt(periodoMatch[1], 10) : 0;

      periodos.push({
        label,
        hdKeyTD,
        periodoNumero,
      });
    });

    if (periodos.length > 0) {
      return { periodos, formAction };
    }
  }

  // Tenta formato 2: Links diretos (<a> com href)
  // Formato esperado: <a href="URL">ANO - CURSO<br>CURSO<br>Turma: XXX<br>Período: N</a>
  console.log('[CONTEXTO_PARSER] Tentando formato de links diretos...');

  // Primeiro tenta encontrar links com o padrão esperado
  $('a').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    const onclick = $el.attr('onclick');

    // Pula links sem href ou onclick
    if (!href && !onclick) return;

    // Pula links que não parecem ser de período
    const text = $el.html() || $el.text() || '';

    // Verifica se tem "Período: N" no texto
    const periodoMatch = text.match(/Per[íi]odo:\s*(\d+)/);
    if (!periodoMatch) return;

    // Extrai o label completo - pode estar no formato HTML
    // Ex: "20252 - Medicina<br>MEDICINA<br>Turma:&nbsp;M80D525.2&nbsp;|&nbsp;Período:&nbsp;5"
    const label = text.replace(/<br\s*\/?>/gi, ' | ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

    const periodoNumero = parseInt(periodoMatch[1], 10);

    // Para links diretos, precisamos extrair o hdKeyTD ou a URL de destino
    let hdKeyTD = '';
    let formAction = '/EducaMobile/Educacional/EduContexto/SetContextoAluno';

    if (onclick) {
      // Tenta extrair do onclick (formato SubmitForm)
      hdKeyTD = extractHdKeyTD(onclick);
    } else if (href) {
      // Se tem href direto, usa a URL como hdKeyTD
      hdKeyTD = href;
    }

    // Adiciona apenas se tiver um ID válido
    if (hdKeyTD) {
      periodos.push({
        label,
        hdKeyTD,
        periodoNumero,
      });
    }
  });

  if (periodos.length > 0) {
    console.log('[CONTEXTO_PARSER] Períodos encontrados (formato links):', periodos.map(p => ({
      label: p.label.substring(0, 60),
      periodoNumero: p.periodoNumero,
      hdKeyTD_length: p.hdKeyTD.length,
    })));
    return { periodos, formAction: '/EducaMobile/Educacional/EduContexto/SetContextoAluno' };
  }

  console.log('[CONTEXTO_PARSER] Nenhum período encontrado em nenhum formato');
  return null;
}

/**
 * Extrai o hdKeyTD do onclick
 *
 * O onclick tem formato: SubmitForm('LABEL_BASE64', 'HDKEYTD_GIGANTE...')
 * O hdKeyTD é uma string gigante com escape sequences como \AB\0C\05...
 */
function extractHdKeyTD(onclick: string): string {
  // O segundo parâmetro é o hdKeyTD
  const match = onclick.match(/SubmitForm\('[^']+',\s*'([^']+)'/);
  return match ? match[1] : '';
}

/**
 * Retorna o período mais novo (maior número de período)
 */
export function selecionarPeriodoMaisNovo(selecao: SelecaoPeriodo): PeriodoOpcao | null {
  if (selecao.periodos.length === 0) return null;

  // Ordena por períodoNumero decrescente e retorna o primeiro
  const sorted = [...selecao.periodos].sort((a, b) => b.periodoNumero - a.periodoNumero);
  return sorted[0];
}

/**
 * Constrói o body para POST de seleção de período
 *
 * O body deve conter:
 * - hdKeyTD: o token criptografado (já vem com escape sequences)
 * - hdLabel: o label do período (URL encoded)
 * - hdcbSalvarContexto: false (não salvar contexto)
 *
 * IMPORTANTE: hdKeyTD não pode passar por URLSearchParams porque causa
 * double encoding. O valor já vem com escapes como \AB\0C que precisam
 * ser convertidos para %5cAB%5c0C apenas UMA vez.
 */
export function buildPeriodoSelectionBody(periodo: PeriodoOpcao): string {
  // O hdKeyTD tem escape sequences como \AB\0C\05...
  // Precisamos converter APENAS as barras invertidas para %5c
  // O restante do valor já está no formato correto do onclick
  const encodedKeyTD = periodo.hdKeyTD.replace(/\\/g, '%5c');

  // hdLabel precisa de encoding normal (encodeURIComponent + substituições)
  const encodedLabel = encodeURIComponent(periodo.label);

  // Monta o body manualmente para evitar double encoding do hdKeyTD
  return `hdKeyTD=${encodedKeyTD}&hdLabel=${encodedLabel}&hdcbSalvarContexto=false`;
}
