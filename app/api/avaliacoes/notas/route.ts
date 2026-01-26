/**
 * POST /api/avaliacoes/notas
 * Busca as avaliações de uma disciplina específica
 *
 * Body: { codigo: string }
 */

import { NextResponse } from 'next/server';
import { getExternalCookies } from '@/lib/session';
import { formatCookiesForRequest } from '@/lib/external-auth';
import { ensureTotvsContext, TotvsContextError } from '@/lib/totvs-context';

interface Avaliacao {
  nome: string;
  data?: string;
  nota?: string;
  valor?: string;
}

interface CategoriaComAvaliacoes {
  nome: string;
  avaliacoes: Avaliacao[];
  notaTotal?: number;  // soma das notas
  valorTotal?: number; // soma dos valores
  porcentagem?: number; // nota/valor * 100
}

interface ResultadoAvaliacoes {
  categorias: CategoriaComAvaliacoes[];
  somativaGeral?: number;
  somativaGeralPorcentagem?: number;
  mediaParaAprovacao: number;
}

// Pesos de cada categoria
const PESOS: Record<string, number> = {
  'Avaliação Parcial': 0.3,
  'Avaliação Somativa': 0.3,
  'Avaliação Formativa': 0.4,
  'Nota Parcial': 0.3,
  'Nota Somativa': 0.3,
  'Nota Formativa': 0.4,
};

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAvaliacoesHTML(html: string): ResultadoAvaliacoes {
  const categorias: CategoriaComAvaliacoes[] = [];

  // Encontrar a ul data-role="listview"
  const ulMatch = html.match(/<ul[^>]*data-role="listview"[^>]*>([\s\S]*?)<\/ul>/);
  if (!ulMatch) {
    return { categorias, mediaParaAprovacao: 60 };
  }

  const ulContent = ulMatch[1];

  // Split por list-divider para separar categorias
  const parts = ulContent.split(/<li[^>]*data-role="list-divider"[^>]*>([^<]+)<\/li>/);

  // Iterar sobre os pares
  for (let i = 1; i < parts.length; i += 2) {
    const nomeCategoria = decodeHTMLEntities(parts[i] || '').trim();
    const contentPart = parts[i + 1] || '';

    if (!contentPart) continue;

    const avaliacoesDaCategoria: Avaliacao[] = [];
    let notaTotal = 0;
    let valorTotal = 0;

    // Encontrar cada li de avaliação dentro desta categoria
    const liRegex = /<li[^>]*style="[^"]*padding-bottom:1px"[^>]*>([\s\S]*?)<\/li>/g;
    let match;

    while ((match = liRegex.exec(contentPart)) !== null) {
      const liContent = match[1];

      const nomeMatch = liContent.match(/^\s*([^\s<][^<\n]*)/);
      const nome = nomeMatch ? decodeHTMLEntities(nomeMatch[1]).trim() : '';

      const dataMatch = liContent.match(/Data da avalia&#231;&#227;o:\s*(\d{2}\/\d{2}\/\d{4})/);
      const data = dataMatch ? dataMatch[1] : undefined;

      const notaMatch = liContent.match(/<span[^>]*class="ui-li-count"[^>]*>([^<]*)<\/span>/);
      const notaStr = notaMatch ? notaMatch[1].trim() : undefined;

      const valorMatch = liContent.match(/Valor da avalia&#231;&#227;o:\s*([^<\n]+)/);
      const valorStr = valorMatch ? decodeHTMLEntities(valorMatch[1]).trim() : undefined;

      if (nome && nome !== '&nbsp;') {
        const avaliacao: Avaliacao = { nome, data };

        // Converter nota para número
        if (notaStr && notaStr !== '') {
          const notaNum = parseFloat(notaStr.replace(',', '.'));
          if (!isNaN(notaNum)) {
            avaliacao.nota = notaStr;
            notaTotal += notaNum;
          }
        }

        // Converter valor para número
        if (valorStr) {
          const valorNum = parseFloat(valorStr.replace(',', '.'));
          if (!isNaN(valorNum)) {
            avaliacao.valor = valorStr;
            valorTotal += valorNum;
          }
        }

        avaliacoesDaCategoria.push(avaliacao);
      }
    }

    // Calcular porcentagem da categoria
    const porcentagem = valorTotal > 0 ? (notaTotal / valorTotal) * 100 : 0;

    categorias.push({
      nome: nomeCategoria,
      avaliacoes: avaliacoesDaCategoria,
      notaTotal,
      valorTotal,
      porcentagem,
    });
  }

  // Filtrar categorias indesejadas
  const categoriasFiltradas = categorias.filter(cat =>
    cat.nome !== 'Nota Parcial' && cat.nome !== 'Nota Final'
  );

  // Calcular somativa geral (média ponderada)
  // Só considera categorias que têm notas lançadas (notaTotal > 0)
  let somativaGeral = 0;
  let pesoTotalUsado = 0;

  for (const cat of categoriasFiltradas) {
    const peso = PESOS[cat.nome];
    // Só considera se tiver peso definido, valor total > 0 e notaTotal > 0 (tem notas lançadas)
    if (peso && cat.valorTotal! > 0 && cat.notaTotal! > 0) {
      const mediaCategoria = cat.notaTotal! / cat.valorTotal!;
      somativaGeral += mediaCategoria * peso;
      pesoTotalUsado += peso;
    }
  }

  // Normalizar se nem todos os pesos foram usados (algumas categorias sem nota)
  if (pesoTotalUsado > 0 && pesoTotalUsado < 1) {
    somativaGeral = somativaGeral / pesoTotalUsado;
  }

  const somativaGeralPorcentagem = somativaGeral > 0 ? somativaGeral * 100 : 0;

  return {
    categorias: categoriasFiltradas,
    somativaGeral: somativaGeral > 0 ? parseFloat(somativaGeral.toFixed(2)) * 100 : undefined, // 0-100, não 0-1
    somativaGeralPorcentagem: somativaGeralPorcentagem > 0 ? parseFloat(somativaGeralPorcentagem.toFixed(1)) : undefined,
    mediaParaAprovacao: 60,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { codigo } = body;

    if (!codigo) {
      return NextResponse.json(
        { error: 'Código da disciplina é obrigatório', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const externalCookies = await getExternalCookies();

    if (!externalCookies) {
      return NextResponse.json(
        { error: 'Sessão não encontrada. Faça login novamente.', code: 'SESSION_MISSING' },
        { status: 401 }
      );
    }

    const cookieHeader = formatCookiesForRequest(externalCookies);

    const BASE_URL = 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br';
    const GET_NOTAS_URL = `${BASE_URL}/EducaMobile/Educacional/EduAluno/GetNotasAvaliacao`;

    // Garantir contexto (seleção de período, quando necessário)
    try {
      await ensureTotvsContext(cookieHeader);
    } catch (error) {
      if (error instanceof TotvsContextError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        );
      }
      return NextResponse.json(
        { error: 'Sistema da TOTVS possivelmente fora do ar.', code: 'TOTVS_OFFLINE' },
        { status: 503 }
      );
    }

    // 2) POST para GetNotasAvaliacao com o código da disciplina

    let response: Response;
    try {
      response = await fetch(GET_NOTAS_URL, {
        method: 'POST',
        headers: {
          Cookie: cookieHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Dest': 'document',
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          Referer: GET_NOTAS_URL,
          Origin: BASE_URL,
          Connection: 'keep-alive',
        },
        body: `ddlTurmaDisc=${codigo}`,
      });
    } catch {
      return NextResponse.json(
        { error: 'Sistema da TOTVS possivelmente fora do ar.', code: 'TOTVS_OFFLINE' },
        { status: 503 }
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Sessão expirada no sistema TOTVS', code: 'SESSION_EXPIRED' },
          { status: 401 }
        );
      }
      if (response.status >= 500) {
        return NextResponse.json(
          { error: 'Sistema da TOTVS possivelmente fora do ar.', code: 'TOTVS_OFFLINE' },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: 'Erro ao buscar avaliações', code: 'UPSTREAM_ERROR' },
        { status: 502 }
      );
    }

    const html = await response.text();

    // Verificar se redirecionou para login (apenas pela URL, não pelo conteúdo HTML)
    const url = response.url.toLowerCase();
    const isLoginPage = url.includes('loginexternoapp') ||
                        url.includes('account/login') ||
                        url.includes('loginexterno');

    if (isLoginPage) {
      return NextResponse.json(
        { error: 'Sessão expirada. Faça login novamente.', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    return NextResponse.json(parseAvaliacoesHTML(html));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: 'Erro ao buscar avaliações', code: 'INTERNAL_ERROR', details: errorMessage },
      { status: 500 }
    );
  }
}
