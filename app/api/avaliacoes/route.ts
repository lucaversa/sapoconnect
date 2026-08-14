/** Backward-compatible lightweight discipline listing. */
import { parseDisciplinasHTML } from '@/lib/avaliacoes-parser';
import { fetchTOTVSResponse, HTTPError } from '@/lib/totvs-api';

export async function GET() {
  return fetchTOTVSResponse(
    '/EducaMobile/Educacional/EduAluno/EduNotasAvaliacao?tp=A',
    parseDisciplinasHTML,
    '[Avaliacoes]',
    {
      validate: (data) => {
        if (!data.disciplinas?.length) {
          throw new HTTPError('Falha ao validar sessão. Tente novamente.', 401, 'SESSION_EXPIRED');
        }
      },
    }
  );
}
