/**
 * POST /api/avaliacoes/notas
 * Busca as avaliacoes de uma disciplina especifica.
 *
 * Body: { codigo: string }
 */

import { NextResponse } from 'next/server';
import { getExternalCookies } from '@/lib/session';
import { formatCookiesForRequest } from '@/lib/external-auth';
import { parseAvaliacoesHTML } from '@/lib/avaliacoes-parser';
import { ensureTotvsContext, TotvsContextError } from '@/lib/totvs-context';

const BASE_URL = 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br';
const GET_NOTAS_URL = `${BASE_URL}/EducaMobile/Educacional/EduAluno/GetNotasAvaliacao`;

function isLoginResponse(response: Response): boolean {
  const url = response.url.toLowerCase();
  return url.includes('loginexternoapp') ||
    url.includes('account/login') ||
    url.includes('loginexterno');
}

async function fetchNotasHTML(codigo: string, cookieHeader: string): Promise<Response> {
  return fetch(GET_NOTAS_URL, {
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
    body: `ddlTurmaDisc=${encodeURIComponent(codigo)}`,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { codigo } = body;

    if (!codigo) {
      return NextResponse.json(
        { error: 'Codigo da disciplina e obrigatorio', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const externalCookies = await getExternalCookies();

    if (!externalCookies) {
      return NextResponse.json(
        { error: 'Sessao nao encontrada. Faca login novamente.', code: 'SESSION_MISSING' },
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

    let response: Response;
    try {
      response = await fetchNotasHTML(codigo, cookieHeader);
    } catch {
      return NextResponse.json(
        { error: 'Sistema da TOTVS possivelmente fora do ar.', code: 'TOTVS_OFFLINE' },
        { status: 503 }
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Sessao expirada no sistema TOTVS', code: 'SESSION_EXPIRED' },
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
        { error: 'Erro ao buscar avaliacoes', code: 'UPSTREAM_ERROR' },
        { status: 502 }
      );
    }

    const html = await response.text();

    if (isLoginResponse(response)) {
      return NextResponse.json(
        { error: 'Sessao expirada. Faca login novamente.', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    const resultado = parseAvaliacoesHTML(html);

    if (!resultado.categorias || resultado.categorias.length === 0) {
      return NextResponse.json(
        { error: 'Falha ao validar sessao. Tente novamente.', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    return NextResponse.json(resultado);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: 'Erro ao buscar avaliacoes', code: 'INTERNAL_ERROR', details: errorMessage },
      { status: 500 }
    );
  }
}
