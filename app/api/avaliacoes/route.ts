/**
 * GET /api/avaliacoes
 * Lista as disciplinas disponíveis para ver avaliações
 */

import { fetchTOTVSResponse, HTTPError } from '@/lib/totvs-api';

interface DisciplinaOpcao {
  codigo: string;
  nome: string;
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
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDisciplinasHTML(html: string): { disciplinas: DisciplinaOpcao[] } {
  const disciplinas: DisciplinaOpcao[] = [];

  const selectMatch = html.match(/<select[^>]*id="ddlTurmaDisc"[^>]*>([\s\S]*?)<\/select>/);
  if (!selectMatch) {
    return { disciplinas };
  }

  const selectContent = selectMatch[1];

  // Encontrar todas as options (exceto a primeira "Selecione uma opção")
  const optionRegex = /<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/g;
  let match;

  while ((match = optionRegex.exec(selectContent)) !== null) {
    const codigo = match[1];
    let nome = decodeHTMLEntities(match[2]);

    // Remover prefixo numérico (ex: "1-83-057-PRÁTICA..." → "PRÁTICA...")
    nome = nome.replace(/^\d+-[\d-]+-/, '');

    // Pular a opção padrão "Selecione uma opção"
    if (codigo === '-1') continue;

    disciplinas.push({
      codigo,
      nome,
    });
  }

  return { disciplinas };
}

export async function GET() {
  return fetchTOTVSResponse(
    '/EducaMobile/Educacional/EduAluno/EduNotasAvaliacao?tp=A',
    parseDisciplinasHTML,
    '[Avaliacoes]',
    {
      validate: (data) => {
        if (!data.disciplinas || data.disciplinas.length === 0) {
          throw new HTTPError('Falha ao validar sessão. Tente novamente.', 401, 'SESSION_EXPIRED');
        }
      },
    }
  );
}
