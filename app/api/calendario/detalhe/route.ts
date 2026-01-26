/**
 * GET /api/calendario/detalhe?id=123456
 * Obtém os detalhes de uma aula específica (incluindo professores)
 */

import { NextResponse } from 'next/server';
import { getExternalCookies } from '@/lib/session';
import { formatCookiesForRequest } from '@/lib/external-auth';
import { parseDetalheHTML } from '@/lib/html-detalhe-parser';

const DETALHE_URL =
  'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Educacional/EduAluno/EduQuadroHorarioAlunoDetalhe';

/**
 * Detecta se a resposta é uma página de login externo.
 * Verifica apenas a URL.
 */
function isExternalLoginResponse(response: Response): boolean {
  const url = response.url.toLowerCase();
  return (
    url.includes('loginexternoapp') ||
    url.includes('account/login') ||
    url.includes('loginexterno')
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
    return NextResponse.json(
      { error: 'ID da aula é obrigatório', code: 'BAD_REQUEST' },
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

    const response = await fetch(`${DETALHE_URL}/${id}`, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Cookie: cookieHeader,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        Referer: 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Home/Index',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Sessão expirada no sistema TOTVS', code: 'SESSION_EXPIRED' },
          { status: 401 }
        );
      }
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    if (isExternalLoginResponse(response)) {
      return NextResponse.json(
        { error: 'Sessão externa expirada. Tente novamente.', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    const html = await response.text();
    const detalhe = parseDetalheHTML(html);

    return NextResponse.json(detalhe);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const isTotvsOffline = /HTTP 5\d{2}/.test(errorMessage) || errorMessage.includes('fetch');
    if (isTotvsOffline) {
      return NextResponse.json(
        { error: 'Sistema da TOTVS possivelmente fora do ar.', code: 'TOTVS_OFFLINE', details: errorMessage },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Erro ao buscar detalhes da aula', code: 'INTERNAL_ERROR', details: errorMessage },
      { status: 500 }
    );
  }
}
