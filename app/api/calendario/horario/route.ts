/**
 * GET /api/calendario/horario
 * Obtem o quadro de horarios do aluno
 *
 * Fluxo:
 * 1. Faz GET para HORARIOS_URL com cookies de sessao
 * 2. Se retornar tela de seleção de período:
 *    - Detecta todos os períodos disponíveis
 *    - Seleciona automaticamente o mais novo
 *    - Faz POST para SetContextoAluno
 *    - Refaz o GET para HORARIOS_URL
 * 3. Se retornar redirect para GetContextoAluno (fluxo antigo), acessa e tenta novamente
 * 4. Parseia o HTML retornado e extrai as aulas
 *
 * MODO MOCK: Sete USE_MOCK = true para usar horarios.html local (teste)
 */

import { NextResponse } from 'next/server';
import { getExternalCookies } from '@/lib/session';
import { formatCookiesForRequest } from '@/lib/external-auth';
import { parseHorariosHTML } from '@/lib/html-horarios-parser';
import {
  parseSelecaoPeriodo,
  selecionarPeriodoMaisNovo,
  buildPeriodoSelectionBody,
  isTelaSelecaoPeriodo,
} from '@/lib/contexto-parser';
import { readFile } from 'fs/promises';
import { join } from 'path';

// ============ MODO MOCK (teste) ============
// Sete false para voltar ao normal (API externa)
const USE_MOCK = false;
// ===========================================

const HORARIOS_URL =
  'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Educacional/EduAluno/EduQuadroHorarioAluno?tp=A';

const CONTEXTO_URL =
  'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Educacional/EduContexto/GetContextoAluno';

const SET_CONTEXTO_URL =
  'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Educacional/EduContexto/SetContextoAluno';

/**
 * Detecta se a resposta é uma página de login externo.
 *
 * Verifica apenas a URL, não o conteúdo HTML, pois páginas válidas
 * podem conter referências a 'login' em scripts/links sem serem páginas de login.
 *
 * Uma página de login real terá a URL alterada para a página de login.
 */
function isExternalLoginResponse(response: Response, _html: string): boolean {
  const url = response.url.toLowerCase();

  // Verifica se a URL foi redirecionada para página de login
  return (
    url.includes('loginexternoapp') ||
    url.includes('account/login') ||
    url.includes('loginexterno')
  );
}

export async function GET() {
  try {
    let html: string;

    // ============ MODO MOCK (teste) ============
    if (USE_MOCK) {
      console.log('[HORARIO] MODO MOCK ATIVADO');
      const mockPath = join(process.cwd(), 'horarios.html');
      html = await readFile(mockPath, 'utf-8');
    } else {
    // ============ MODO NORMAL (API externa) ============
      console.log('[HORARIO] Iniciando fetch de horários...');

      const externalCookies = await getExternalCookies();

      if (!externalCookies) {
        console.log('[HORARIO] ERRO: Sessão não encontrada');
        return NextResponse.json(
          { error: 'Sessão não encontrada. Faça login novamente.', code: 'SESSION_MISSING' },
          { status: 401 }
        );
      }

      console.log('[HORARIO] Cookies externos obtidos:', Object.keys(externalCookies).length, 'cookies');

      const cookieHeader = formatCookiesForRequest(externalCookies);
      console.log('[HORARIO] Cookie header length:', cookieHeader.length);

      // 1) Primeira chamada para HORARIOS_URL
      console.log('[HORARIO] STEP 1: Fazendo GET para HORARIOS_URL');

      let response = await fetch(HORARIOS_URL, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Cookie: cookieHeader,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          Referer: 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Home/Index',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Dest': 'document',
        },
      });

      console.log('[HORARIO] Response status:', response.status, 'url:', response.url);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('[HORARIO] ERRO: Sessão expirada no sistema TOTVS');
          return NextResponse.json(
            { error: 'Sessão expirada no sistema TOTVS', code: 'SESSION_EXPIRED' },
            { status: 401 }
          );
        }
        throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
      }

      html = await response.text();
      console.log('[HORARIO] HTML recebido, length:', html.length);
      console.log('[HORARIO] HTML preview (primeiros 500 chars):', html.substring(0, 500));

      if (isExternalLoginResponse(response, html)) {
        console.log('[HORARIO] ERRO: Login externo expirado');
        return NextResponse.json(
          { error: 'Sessão externa expirada. Tente novamente.', code: 'SESSION_EXPIRED' },
          { status: 401 }
        );
      }

      // 2) VERIFICA SE É TELA DE SELEÇÃO DE PERÍODO
      console.log('[HORARIO] STEP 2: Verificando se é tela de seleção de período...');
      const isTelaSelecao = isTelaSelecaoPeriodo(html);
      console.log('[HORARIO] isTelaSelecaoPeriodo:', isTelaSelecao);

      // Debug: mostrar palavras-chave encontradas
      const hasPeriodoLetivo = html.toLowerCase().includes('período letivo') || html.toLowerCase().includes('periodo letivo');
      const hasSelecione = html.toLowerCase().includes('selecione um período letivo') || html.toLowerCase().includes('selecione um periodo letivo');
      const hasGetContextoKeyword = html.includes('GetContextoAluno');
      console.log('[HORARIO] Keywords check:', { hasPeriodoLetivo, hasSelecione, hasGetContextoKeyword });

      if (isTelaSelecao) {
        console.log('[HORARIO] TELA DE SELEÇÃO DETECTADA! Parseando opções...');

        const selecao = parseSelecaoPeriodo(html);

        if (selecao) {
          console.log('[HORARIO] Seleção parseada:', {
            periodosEncontrados: selecao.periodos.length,
            formAction: selecao.formAction,
            periodos: selecao.periodos.map(p => ({
              label: p.label.substring(0, 50) + '...',
              periodoNumero: p.periodoNumero,
              hdKeyTD_length: p.hdKeyTD.length,
            })),
          });

          if (selecao.periodos.length > 0) {
            // Seleciona o período mais novo
            const periodoSelecionado = selecionarPeriodoMaisNovo(selecao);

            if (periodoSelecionado) {
              console.log('[HORARIO] Período selecionado:', {
                label: periodoSelecionado.label,
                periodoNumero: periodoSelecionado.periodoNumero,
                hdKeyTD_preview: periodoSelecionado.hdKeyTD.substring(0, 100),
              });

              // Verifica se é um link direto (começa com / ou http) ou um token POST
              const isDirectLink = periodoSelecionado.hdKeyTD.startsWith('/') ||
                                  periodoSelecionado.hdKeyTD.startsWith('http');

              if (isDirectLink) {
                console.log('[HORARIO] STEP 3: Período é link direto, fazendo GET para:', periodoSelecionado.hdKeyTD);

                // Constrói URL completa se for caminho relativo
                const contextoUrl = periodoSelecionado.hdKeyTD.startsWith('http')
                  ? periodoSelecionado.hdKeyTD
                  : `https://fundacaoeducacional132827.rm.cloudtotvs.com.br${periodoSelecionado.hdKeyTD}`;

                const contextoResponse = await fetch(contextoUrl, {
                  method: 'GET',
                  redirect: 'follow',
                  headers: {
                    Cookie: cookieHeader,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'pt-BR,pt;q=0.9',
                    'User-Agent':
                      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
                    Referer: 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Educacional/EduContexto/GetContextoAluno',
                  },
                });

                console.log('[HORARIO] GET Response status:', contextoResponse.status);
                console.log('[HORARIO] GET Response url:', contextoResponse.url);

                if (!contextoResponse.ok) {
                  console.log('[HORARIO] ERRO no GET:', contextoResponse.status);
                  throw new Error(`Erro ao selecionar período: HTTP ${contextoResponse.status}`);
                }

                // Após o GET, busca novamente o horário
                console.log('[HORARIO] GET OK! Buscando horário novamente...');

                response = await fetch(HORARIOS_URL, {
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

                console.log('[HORARIO] Segundo GET status:', response.status, 'url:', response.url);

                if (!response.ok) {
                  throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
                }

                html = await response.text();
                console.log('[HORARIO] HTML após seleção de período, length:', html.length);

                if (isExternalLoginResponse(response, html)) {
                  console.log('[HORARIO] ERRO: Login externo expirado após seleção de período');
                  return NextResponse.json(
                    { error: 'Sessão externa expirada. Tente novamente.', code: 'SESSION_EXPIRED' },
                    { status: 401 }
                  );
                }

                // Verificar se ainda é tela de seleção (erro na seleção)
                if (isTelaSelecaoPeriodo(html)) {
                  console.log('[HORARIO] ERRO: Ainda é tela de seleção após GET! A seleção pode ter falhado.');
                } else {
                  console.log('[HORARIO] SUCESSO: Período selecionado via link direto!');
                }
              } else {
                // Formato tradicional: POST para SetContextoAluno
                console.log('[HORARIO] STEP 3: Período é token, fazendo POST para SET_CONTEXTO_URL');

                const postBody = buildPeriodoSelectionBody(periodoSelecionado);
                console.log('[HORARIO] POST body length:', postBody.length);
                console.log('[HORARIO] POST body preview:', postBody.substring(0, 200) + '...');

                const contextoResponse = await fetch(SET_CONTEXTO_URL, {
                  method: 'POST',
                  redirect: 'follow',
                  headers: {
                    Cookie: cookieHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent':
                      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
                    Referer:
                      'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Educacional/EduContexto/GetContextoAluno',
                    Origin: 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br',
                  },
                  body: postBody,
                });

                console.log('[HORARIO] POST Response status:', contextoResponse.status);
                console.log('[HORARIO] POST Response url:', contextoResponse.url);

                if (!contextoResponse.ok) {
                  console.log('[HORARIO] ERRO no POST:', contextoResponse.status);
                  const postHtml = await contextoResponse.text();
                  console.log('[HORARIO] POST Response HTML preview:', postHtml.substring(0, 500));
                  throw new Error(
                    `Erro ao selecionar período: HTTP ${contextoResponse.status}`
                  );
                }

                // Após o POST, busca novamente o horário
                console.log('[HORARIO] POST OK! Buscando horário novamente...');

                response = await fetch(HORARIOS_URL, {
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

                console.log('[HORARIO] Segundo GET status:', response.status, 'url:', response.url);

                if (!response.ok) {
                  throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
                }

                html = await response.text();
                console.log('[HORARIO] HTML após seleção de período, length:', html.length);

                if (isExternalLoginResponse(response, html)) {
                  console.log('[HORARIO] ERRO: Login externo expirado após seleção de período');
                  return NextResponse.json(
                    { error: 'Sessão externa expirada. Tente novamente.', code: 'SESSION_EXPIRED' },
                    { status: 401 }
                  );
                }

                // Verificar se ainda é tela de seleção (erro na seleção)
                if (isTelaSelecaoPeriodo(html)) {
                  console.log('[HORARIO] ERRO: Ainda é tela de seleção após POST! A seleção pode ter falhado.');
                } else {
                  console.log('[HORARIO] SUCESSO: Período selecionado via POST!');
                }
              }
            } else {
              console.log('[HORARIO] ERRO: Nenhum período selecionado (selecionarPeriodoMaisNovo retornou null)');
            }
          } else {
            console.log('[HORARIO] AVISO: Tela de seleção detectada mas nenhum período encontrado');
          }
        } else {
          console.log('[HORARIO] ERRO: parseSelecaoPeriodo retornou null');
        }
      } else {
        console.log('[HORARIO] Não é tela de seleção de período, continuando...');
      }

      // 3) Tratamento EXISTENTE de "Object moved" + "GetContextoAluno"
      // (caso não seja seleção de período mas ainda precise de contexto)
      const hasObjectMoved = html.includes('Object moved');
      const hasGetContexto = html.includes('GetContextoAluno');

      console.log('[HORARIO] STEP 4: Verificando Object moved / GetContextoAluno...');
      console.log('[HORARIO] hasObjectMoved:', hasObjectMoved, 'hasGetContexto:', hasGetContexto);

      if (hasObjectMoved && hasGetContexto) {
        console.log('[HORARIO] Detectado Object moved + GetContextoAluno, fazendo GET para CONTEXTO_URL');

        await fetch(CONTEXTO_URL, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            Cookie: cookieHeader,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
            Referer:
              'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Home/Index',
          },
        });

        console.log('[HORARIO] CONTEXTO_URL chamada, buscando horário novamente...');

        // Tenta novamente
        response = await fetch(HORARIOS_URL, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            Cookie: cookieHeader,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
            Referer:
              'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Home/Index',
          },
        });

        console.log('[HORARIO] Response após CONTEXTO_URL:', response.status, 'url:', response.url);

        if (!response.ok) {
          if (response.status === 401) {
            console.log('[HORARIO] ERRO: Sessão expirada após CONTEXTO_URL');
          return NextResponse.json(
            { error: 'Sessão expirada no sistema TOTVS', code: 'SESSION_EXPIRED' },
            { status: 401 }
          );
          }
          throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
        }

        html = await response.text();
        console.log('[HORARIO] HTML após CONTEXTO_URL, length:', html.length);

        if (isExternalLoginResponse(response, html)) {
          console.log('[HORARIO] ERRO: Login externo expirado após CONTEXTO_URL');
          return NextResponse.json(
            { error: 'Sessão externa expirada. Tente novamente.', code: 'SESSION_EXPIRED' },
            { status: 401 }
          );
        }
      }
    }
    // ===========================================

    // 4) Parseia o HTML e extrai as aulas
    console.log('[HORARIO] STEP 5: Parseando HTML para extrair aulas...');
    const aulas = parseHorariosHTML(html);
    console.log('[HORARIO] Aulas extraídas:', aulas.length, 'aulas');

    if (aulas.length === 0) {
      console.log('[HORARIO] ERRO: Nenhuma aula encontrada. Sessão possivelmente expirada.');
      return NextResponse.json(
        { error: 'Sessão expirada no sistema TOTVS', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    return NextResponse.json({ aulas });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.log('[HORARIO] CATCH ERROR:', errorMessage);
    console.log('[HORARIO] Error stack:', error instanceof Error ? error.stack : 'no stack');

    const isTotvsOffline = /HTTP 5\d{2}/.test(errorMessage) || errorMessage.includes('fetch');
    if (isTotvsOffline) {
      return NextResponse.json(
        { error: 'Sistema da TOTVS possivelmente fora do ar.', code: 'TOTVS_OFFLINE', details: errorMessage },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Erro ao buscar horário', code: 'INTERNAL_ERROR', details: errorMessage },
      { status: 500 }
    );
  }
}
