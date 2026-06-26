/**
 * GET /api/avaliacoes
 * Lista as disciplinas disponiveis para ver avaliacoes.
 */

import { parseDisciplinasHTML } from '@/lib/avaliacoes-parser';
import { fetchTOTVSResponse, HTTPError } from '@/lib/totvs-api';

export async function GET() {
  return fetchTOTVSResponse(
    '/EducaMobile/Educacional/EduAluno/EduNotasAvaliacao?tp=A',
    parseDisciplinasHTML,
    '[Avaliacoes]',
    {
      validate: (data) => {
        if (!data.disciplinas || data.disciplinas.length === 0) {
          throw new HTTPError('Falha ao validar sessao. Tente novamente.', 401, 'SESSION_EXPIRED');
        }
      },
    }
  );
}
