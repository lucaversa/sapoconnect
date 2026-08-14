/** Backward-compatible lightweight absence endpoint. */
import { fetchTOTVSResponse } from '@/lib/totvs-api';

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

function decodeEntities(text: string): string {
  return text.replace(/&#(\d+);/g, (_, value) => String.fromCharCode(Number(value)));
}

function parseFaltasHTML(html: string): { faltas: FaltasItem[] } {
  const section = html.match(/<h2[^>]*>Aviso de frequ[^<]*<\/h2>[\s\S]*?<\/ul>/)?.[0];
  if (!section) return { faltas: [] };

  const faltas = (section.match(/<li class="no-margin">[\s\S]*?<\/li>/g) ?? []).flatMap((item) => {
    const heading = item.match(/<h3[^>]*>(.*?)<\/h3>/)?.[1]?.replace(/<[^>]*>/g, '').trim();
    const identity = heading?.match(/(\d+-\d+-\d+)\s*\|\s*(.+)/);
    if (!identity) return [];

    const percentageMatch = item.match(/<span class="ui-li-count"(?:\s+style="color:([^"]+)")?[^>]*>([^<]+)<\/span>/);
    const percentage = percentageMatch?.[2]?.trim() ?? '';
    const color = percentageMatch?.[1] ?? '#000000';
    const status = color === '#000000' ? 'abaixo' : color === '#1e84bf' ? 'proximo' : 'acima';

    return [{
      codigo: identity[1],
      disciplina: decodeEntities(identity[2]),
      turma: item.match(/<p>Turma:\s*([^<]+)<\/p>/)?.[1]?.trim() ?? '',
      situacao: decodeEntities(item.match(/<p>Situa&#231;&#227;o:\s*([^<]+)<\/p>/)?.[1] ?? ''),
      limiteFaltas: item.match(/<p[^>]*>Limite de faltas:\s*([^<]+)<\/p>/)?.[1]?.trim() ?? '',
      porcentagem: percentage,
      porcentagemValor: Number.parseFloat(percentage.replace(',', '.').replace('%', '')),
      status,
    } satisfies FaltasItem];
  });

  return { faltas };
}

export async function GET() {
  return fetchTOTVSResponse(
    '/EducaMobile/Educacional/EduAluno/EduAvisos?tp=A',
    parseFaltasHTML,
    '[Faltas]'
  );
}
