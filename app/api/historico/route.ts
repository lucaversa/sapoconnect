/**
 * GET /api/historico
 * Obtem o histórico acadêmico do aluno usando o helper padrão TOTVS
 */

import { fetchTOTVSResponse, HTTPError } from '@/lib/totvs-api';

interface Disciplina {
  nome: string;
  codigo: string;
  creditos: string;
  ch: string;
  chIntegralizada: string;
  situacao: string;
  conceito?: string;
  nota?: string;
  faltas?: string;
  periodo?: string;
  status: 'concluida' | 'pendente' | 'naoconcluida' | 'equivalente';
}

interface Periodo {
  nome: string;
  totalCH: string;
  disciplinas: Disciplina[];
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
    .replace(/\s+/g, ' ')  // Remove espaços duplicados
    .trim();
}

function parseHistoricoHTML(html: string): { periodos: Periodo[] } {
  const periodos: Periodo[] = [];

  // Encontrar todas as listas com data-divider-theme="b"
  const listRegex = /<ul[^>]*data-divider-theme="b"[^>]*>([\s\S]*?)<\/ul>/g;
  const listMatch = html.match(listRegex);

  if (!listMatch) {
    return { periodos };
  }

  const listContent = listMatch[0];

  // Separar por dividers de período
  const dividerRegex = /<li data-role="list-divider">([^<]+)<\/li>/g;
  let currentPeriodo: Periodo | null = null;
  let lastIndex = 0;
  let match;

  while ((match = dividerRegex.exec(listContent)) !== null) {
    // Salvar período anterior se existir
    if (currentPeriodo) {
      periodos.push(currentPeriodo);
    }

    const periodoNome = decodeHTMLEntities(match[1]);
    currentPeriodo = {
      nome: periodoNome,
      totalCH: '',
      disciplinas: []
    };
    lastIndex = match.index + match[0].length;
  }

  // Adicionar o último período
  if (currentPeriodo) {
    periodos.push(currentPeriodo);
  }

  // Agora extrair as disciplinas de cada período
  const itemRegex = /<li data-icon="false">[\s\S]*?<\/li>/g;
  let itemMatch;
  let periodoIndex = 0;

  const resetIndex = dividerRegex.exec(listContent);
  dividerRegex.lastIndex = 0;

  while ((itemMatch = itemRegex.exec(listContent)) !== null) {
    const itemContent = itemMatch[0];

    // Verificar se é o Total CH
    const totalCHMatch = itemContent.match(/<b>Total CH integralizada:\s*([^<]+)<\/b>/i);
    if (totalCHMatch) {
      if (periodos[periodoIndex]) {
        periodos[periodoIndex].totalCH = totalCHMatch[1].trim();
      }
      continue;
    }

    // Extrair nome e status da disciplina
    const h2Match = itemContent.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    if (!h2Match) continue;

    const h2Content = h2Match[1];

    // Determinar status baseado na imagem
    let status: 'concluida' | 'pendente' | 'naoconcluida' | 'equivalente' = 'pendente';
    if (h2Content.includes('img_concluida.PNG')) {
      status = 'concluida';
    } else if (h2Content.includes('img_pendente.PNG')) {
      status = 'pendente';
    } else if (h2Content.includes('img_naoconcluida.PNG')) {
      status = 'naoconcluida';
    } else if (h2Content.includes('equivalente.gif')) {
      status = 'equivalente';
    }

    // Extrair nome da disciplina (remover a tag img)
    const nome = h2Content.replace(/<img[^>]*>/g, '').trim();

    // Extrair detalhes do parágrafo
    const pMatch = itemContent.match(/<p>([\s\S]*?)<\/p>/);
    if (!pMatch) continue;

    const pContent = pMatch[1];

    // Extrair código
    const codigoMatch = pContent.match(/<b>C&#243;d\. disciplina:<\/b>\s*([^<]+)/);
    const codigo = codigoMatch ? codigoMatch[1].trim() : '';

    // Extrair créditos
    const creditosMatch = pContent.match(/<b>Cr&#233;ditos:<\/b>\s*([^<]+)/);
    const creditos = creditosMatch ? decodeHTMLEntities(creditosMatch[1].trim()) : '';

    // Extrair C.H.
    const chMatch = pContent.match(/<b>C\.H\.:<\/b>\s*([^<]+)/);
    const ch = chMatch ? chMatch[1].trim() : '';

    // Extrair C.H. Integralizada
    const chIntegralMatch = pContent.match(/<b>C\.H\. Integralizada:<\/b>\s*([^<]+)/);
    const chIntegralizada = chIntegralMatch ? chIntegralMatch[1].trim() : '';

    // Extrair situação
    const situacaoMatch = pContent.match(/<b>Situa&#231;&#227;o: <\/b>\s*([^<&]+)/);
    const situacao = situacaoMatch ? decodeHTMLEntities(situacaoMatch[1].trim()) : '';

    // Extrair conceito
    const conceitoMatch = pContent.match(/<b>Conceito:<\/b>\s*([^<]+)/);
    const conceito = conceitoMatch ? conceitoMatch[1].trim() : undefined;

    // Extrair nota
    const notaMatch = pContent.match(/<b>&nbsp;Nota:<\/b>\s*([^<\s]+)/);
    const nota = notaMatch ? notaMatch[1].trim() : undefined;

    // Extrair faltas
    const faltasMatch = pContent.match(/<b>&nbsp;Faltas:<\/b>\s*([^<\s]+)/);
    const faltas = faltasMatch ? faltasMatch[1].trim() : undefined;

    // Extrair período
    const periodoMatch = pContent.match(/\(\s*(\d[^)]*)\s*\)/);
    const periodo = periodoMatch ? periodoMatch[1].trim() : undefined;

    const disciplina: Disciplina = {
      nome,
      codigo,
      creditos,
      ch,
      chIntegralizada,
      situacao,
      status,
    };

    if (conceito) disciplina.conceito = conceito;
    if (nota) disciplina.nota = nota;
    if (faltas) disciplina.faltas = faltas;
    if (periodo) disciplina.periodo = periodo;

    // Adicionar ao período correto
    // Precisamos encontrar a qual período esta disciplina pertence
    // Vamos procurar pelo divider mais recente antes deste item
    const itemIndex = itemMatch.index;
    let currentPeriodoIdx = 0;
    let tempMatch;

    dividerRegex.lastIndex = 0;
    while ((tempMatch = dividerRegex.exec(listContent)) !== null) {
      if (tempMatch.index > itemIndex) break;
      currentPeriodoIdx++;
    }

    const targetPeriodoIdx = Math.max(0, currentPeriodoIdx - 1);
    if (periodos[targetPeriodoIdx]) {
      periodos[targetPeriodoIdx].disciplinas.push(disciplina);
    }
  }

  
  return { periodos };
}

export async function GET() {
  return fetchTOTVSResponse(
    '/EducaMobile/Educacional/EduAluno/EduAnaliseCurricular?tp=A',
    parseHistoricoHTML,
    '[Historico]',
    {
      validate: (data) => {
        if (!data.periodos || data.periodos.length === 0) {
          throw new HTTPError('Falha ao validar sessão. Tente novamente.', 401, 'SESSION_EXPIRED');
        }
      },
    }
  );
}
