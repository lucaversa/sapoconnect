/**
 * GET /api/faltas/completo
 * Obtém faltas enriquecidas com dados de histórico (CH) e horário (aulas)
 */

import { NextResponse } from 'next/server';
import { getExternalCookies } from '@/lib/session';
import { formatCookiesForRequest } from '@/lib/external-auth';
import { parseHorariosHTML } from '@/lib/html-horarios-parser';
import { ensureTotvsContext, TotvsContextError } from '@/lib/totvs-context';

interface DisciplinaHistorico {
  nome: string;
  codigo: string;
  ch: string;
  situacao?: string;
}

interface FaltasItem {
  codigo: string;
  disciplina: string;
  turma: string;
  situacao: string;
  limiteFaltas: string;
  porcentagem: string;
  porcentagemValor: number;
  status: 'abaixo' | 'proximo' | 'acima';
}

interface FaltasItemEnriquecido extends FaltasItem {
  ch?: string;
  umaFaltaPct?: string;
  aulasTotal?: number;
  aulasRealizadas?: number;
  diasRestantes?: number;
}

class TotvsFetchError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'TotvsFetchError';
  }
}

// Normaliza nome da disciplina para matching (remove acentos, lower, etc.)
function normalizarNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, ' ')
    .trim();
}

// Verifica se dois nomes de disciplina são similares (para matching)
function nomesSimilares(nome1: string, nome2: string): boolean {
  const n1 = normalizarNome(nome1);
  const n2 = normalizarNome(nome2);

  // Match exato
  if (n1 === n2) return true;

  // Match contendo (um contém o outro)
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Verifica similaridade por palavras chave
  const palavras1 = n1.split(' ');
  const palavras2 = n2.split(' ');

  // Se pelo menos 70% das palavras coincidem
  const coincidencias = palavras1.filter(p => palavras2.includes(p)).length;
  const ratio = coincidencias / Math.max(palavras1.length, palavras2.length);

  return ratio >= 0.7;
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

function parseFaltasHTML(html: string): FaltasItem[] {
  const itens: FaltasItem[] = [];

  const collapsibleMatch = html.match(/<h2[^>]*>Aviso de frequ[^<]*<\/h2>[\s\S]*?<\/ul>/);
  if (!collapsibleMatch) return itens;

  const collapsibleContent = collapsibleMatch[0];
  const liRegex = /<li class="no-margin">[\s\S]*?<\/li>/g;
  const matches = collapsibleContent.match(liRegex);

  if (!matches) return itens;

  matches.forEach((li) => {
    const h3Match = li.match(/<h3[^>]*>(.*?)<\/h3>/);
    if (!h3Match) return;

    const h3Content = h3Match[1].replace(/<[^>]*>/g, '').trim();
    const codigoMatch = h3Content.match(/(\d+-\d+-\d+)\s*\|\s*(.+)/);

    if (!codigoMatch) return;

    const codigo = codigoMatch[1];
    const disciplina = decodeHTMLEntities(codigoMatch[2]);

    const turmaMatch = li.match(/<p>Turma:\s*([^<]+)<\/p>/);
    const turma = turmaMatch ? turmaMatch[1].trim() : '';

    const situacaoMatch = li.match(/<p>Situa&#231;&#227;o:\s*([^<]+)<\/p>/);
    const situacao = situacaoMatch ? decodeHTMLEntities(situacaoMatch[1]) : '';

    const limiteMatch = li.match(/<p[^>]*>Limite de faltas:\s*([^<]+)<\/p>/);
    const limiteFaltas = limiteMatch ? limiteMatch[1].trim() : '';

    const porcentagemMatch = li.match(/<span class="ui-li-count"(?:\s+style="color:([^"]+)")?[^>]*>([^<]+)<\/span>/);
    const porcentagem = porcentagemMatch ? porcentagemMatch[2].trim() : '';
    const cor = porcentagemMatch && porcentagemMatch[1] ? porcentagemMatch[1] : '#000000';

    const porcentagemValor = parseFloat(porcentagem.replace(',', '.').replace('%', ''));

    let status: 'abaixo' | 'proximo' | 'acima' = 'abaixo';
    if (cor === '#000000') {
      status = 'abaixo';
    } else if (cor === '#1e84bf') {
      status = 'proximo';
    } else {
      status = 'acima';
    }

    itens.push({
      codigo,
      disciplina,
      turma,
      situacao,
      limiteFaltas,
      porcentagem,
      porcentagemValor,
      status,
    });
  });

  return itens;
}

function parseHistoricoHTML(html: string): DisciplinaHistorico[] {
  const disciplinas: DisciplinaHistorico[] = [];

  const listRegex = /<ul[^>]*data-divider-theme="b"[^>]*>([\s\S]*?)<\/ul>/g;
  const listMatch = html.match(listRegex);
  if (!listMatch) return disciplinas;

  const listContent = listMatch[0];
  const itemRegex = /<li data-icon="false">[\s\S]*?<\/li>/g;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(listContent)) !== null) {
    const itemContent = itemMatch[0];

    // Pular o Total CH
    if (itemContent.match(/<b>Total CH integralizada:/i)) continue;

    const h2Match = itemContent.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    if (!h2Match) continue;

    const nome = h2Match[1].replace(/<img[^>]*>/g, '').trim();

    const pMatch = itemContent.match(/<p>([\s\S]*?)<\/p>/);
    if (!pMatch) continue;

    const pContent = pMatch[1];

    const codigoMatch = pContent.match(/<b>C&#243;d\. disciplina:<\/b>\s*([^<]+)/);
    const codigo = codigoMatch ? decodeHTMLEntities(codigoMatch[1].trim()) : '';

    const chMatch = pContent.match(/<b>C\.H\.:<\/b>\s*([^<]+)/);
    const ch = chMatch ? chMatch[1].trim() : '';

    const situacaoMatch = pContent.match(/<b>Situa&#231;&#227;o: <\/b>\s*([^<&]+)/);
    const situacao = situacaoMatch ? decodeHTMLEntities(situacaoMatch[1].trim()) : '';

    disciplinas.push({ nome, codigo, ch, situacao });
  }

  return disciplinas;
}

async function fetchFromTOTVS(url: string, cookies: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Cookie: cookies,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        Referer: 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Home/Index',
      },
    });
  } catch {
    throw new TotvsFetchError('TOTVS_NETWORK', 503);
  }

  if (response.status === 401) {
    throw new TotvsFetchError('TOTVS_401', 401);
  }

  if (!response.ok) {
    throw new TotvsFetchError(`HTTP ${response.status}: ${response.statusText}`, response.status);
  }

  return response.text();
}

export async function GET() {
  try {
    const externalCookies = await getExternalCookies();

    if (!externalCookies) {
      return NextResponse.json(
        { error: 'Sessão não encontrada. Faça login novamente.', code: 'SESSION_MISSING' },
        { status: 401 }
      );
    }

    const cookieHeader = formatCookiesForRequest(externalCookies);

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

    // Buscar dados das 3 fontes com tratamento de erro individual
    const results = await Promise.allSettled([
      fetchFromTOTVS(
        'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Educacional/EduAluno/EduAvisos?tp=A',
        cookieHeader
      ),
      fetchFromTOTVS(
        'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Educacional/EduAluno/EduAnaliseCurricular?tp=A',
        cookieHeader
      ),
      fetchFromTOTVS(
        'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Educacional/EduAluno/EduQuadroHorarioAluno?tp=A',
        cookieHeader
      ),
    ]);

    const [faltasResult, historicoResult, horarioResult] = results;

    if (faltasResult.status === 'rejected') {
      const error = faltasResult.reason;
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

      console.error('[FALTAS API] Erro na fonte primária:', {
        error: errorMessage,
        historicoStatus: historicoResult.status,
        horarioStatus: horarioResult.status,
      });

      if (error instanceof TotvsFetchError) {
        if (error.status === 401) {
          return NextResponse.json(
            { error: 'Sessão expirada no sistema TOTVS', code: 'SESSION_EXPIRED' },
            { status: 401 }
          );
        }
        if (error.status >= 500) {
          return NextResponse.json(
            { error: 'Sistema da TOTVS possivelmente fora do ar.', code: 'TOTVS_OFFLINE', details: errorMessage },
            { status: 503 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Erro ao buscar dados de faltas', code: 'UPSTREAM_ERROR', details: errorMessage },
        { status: 502 }
      );
    }

      // Sucesso - processar dados
      const faltasHtml = faltasResult.value;
      const historicoHtml = historicoResult.status === 'fulfilled' ? historicoResult.value : '';
      const horarioHtml = horarioResult.status === 'fulfilled' ? horarioResult.value : '';

      // Parsear dados
      const faltas = parseFaltasHTML(faltasHtml);
      const historico = historicoHtml ? parseHistoricoHTML(historicoHtml) : [];
      const aulas = horarioHtml ? parseHorariosHTML(horarioHtml) : [];

      // Criar mapa de CH por disciplina (do histórico)
      const chMap = new Map<string, string>();
      historico.forEach((disc) => {
        chMap.set(disc.codigo, disc.ch);
        const nomeNormalizado = normalizarNome(disc.nome);
        if (!chMap.has(`nome:${nomeNormalizado}`)) {
          chMap.set(`nome:${nomeNormalizado}`, disc.ch);
        }
      });

      // Criar mapa de estatísticas de aulas por disciplina (do horário)
      // Armazena cada aula com sua data/hora completa para calcular realizadas corretamente
      const aulasPorDisciplina = new Map<string, {
        total: number;
        datas: Set<string>;
        aulas: Array<{ data: string; hora: string; datetime: Date }>;
      }>();

      aulas.forEach((aula) => {
        const nomeNormalizado = normalizarNome(aula.disciplina);
        if (!aulasPorDisciplina.has(nomeNormalizado)) {
          aulasPorDisciplina.set(nomeNormalizado, { total: 0, datas: new Set(), aulas: [] });
        }
        const stats = aulasPorDisciplina.get(nomeNormalizado)!;
        stats.total++;
        if (aula.data_inicial_iso) {
          stats.datas.add(aula.data_inicial_iso.split('T')[0]);
          // Criar Date completo da aula para verificar se já ocorreu
          const [hora, min] = aula.inicio.split(':').map(Number);
          const aulaDateTime = new Date(aula.data_inicial_iso);
          aulaDateTime.setHours(hora, min, 0, 0);
          stats.aulas.push({
            data: aula.data_inicial_iso,
            hora: aula.inicio,
            datetime: aulaDateTime,
          });
        }
      });

      // Enriquecer faltas com dados adicionais
      const faltasEnriquecidas: FaltasItemEnriquecido[] = faltas.map((falta) => {
        const resultado: FaltasItemEnriquecido = { ...falta };

        // 1. Buscar CH do histórico
        let ch = chMap.get(falta.codigo);
        if (!ch) {
          for (const [key, value] of Array.from(chMap.entries())) {
            if (key.startsWith('nome:')) {
              const nomeHistorico = key.replace('nome:', '');
              if (nomesSimilares(falta.disciplina, nomeHistorico)) {
                ch = value;
                break;
              }
            }
          }
        }

        if (ch) {
          resultado.ch = ch;
          const chParaNumero = ch.replace(',', '.');
          const chNum = parseFloat(chParaNumero);
          if (!isNaN(chNum) && chNum > 0) {
            resultado.umaFaltaPct = ((1 / chNum) * 100).toFixed(2) + '%';
          }
        }

        // 2. Buscar estatísticas de aulas do horário
        const nomeNormalizado = normalizarNome(falta.disciplina);
        if (aulasPorDisciplina.has(nomeNormalizado)) {
          const stats = aulasPorDisciplina.get(nomeNormalizado)!;
          resultado.aulasTotal = stats.total;
          resultado.diasRestantes = stats.datas.size;
        } else {
          for (const [nome, stats] of Array.from(aulasPorDisciplina.entries())) {
            if (nomesSimilares(falta.disciplina, nome)) {
              resultado.aulasTotal = stats.total;
              resultado.diasRestantes = stats.datas.size;
              break;
            }
          }
        }

        // 3. Calcular aulas realizadas (contar apenas aulas que já ocorreram)
        if (resultado.aulasTotal) {
          const stats = aulasPorDisciplina.get(nomeNormalizado)
            || Array.from(aulasPorDisciplina.entries()).find(([nome]) => nomesSimilares(falta.disciplina, nome))?.[1];

          if (stats && stats.aulas.length > 0) {
            // Contar apenas aulas cuja data/hora já passou
            const agora = new Date();
            const aulasPassadas = stats.aulas.filter(aula => aula.datetime <= agora).length;
            resultado.aulasRealizadas = aulasPassadas;
          } else {
            // Fallback para cálculo anterior se não tiver dados de aula
            const faltasPct = falta.porcentagemValor;
            const faltasDadas = (faltasPct / 100) * parseInt(ch || '0');
            resultado.aulasRealizadas = Math.max(0, resultado.aulasTotal - Math.round(faltasDadas));
          }
        }

        return resultado;
      });

      // Ordenar por % de falta decrescente
      faltasEnriquecidas.sort((a, b) => b.porcentagemValor - a.porcentagemValor);

      // Se não há dados e todas as fontes funcionaram, é erro real
      if (faltasEnriquecidas.length === 0 &&
          historicoResult.status === 'fulfilled' &&
          horarioResult.status === 'fulfilled') {
        return NextResponse.json(
          { error: 'Falha ao validar sessão. Tente novamente.', code: 'SESSION_EXPIRED' },
          { status: 401 }
        );
      }

      return NextResponse.json({ faltas: faltasEnriquecidas });

  } catch (error) {
    if (error instanceof TotvsFetchError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'Sessão expirada no sistema TOTVS', code: 'SESSION_EXPIRED' },
          { status: 401 }
        );
      }
      if (error.status >= 500) {
        return NextResponse.json(
          { error: 'Sistema da TOTVS possivelmente fora do ar.', code: 'TOTVS_OFFLINE', details: error.message },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: 'Erro ao buscar dados de faltas', code: 'UPSTREAM_ERROR', details: error.message },
        { status: 502 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: 'Erro ao buscar dados completos de faltas', code: 'INTERNAL_ERROR', details: errorMessage },
      { status: 500 }
    );
  }
}
