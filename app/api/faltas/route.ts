/**
 * GET /api/faltas
 * Obtem as faltas do aluno usando o helper padrão TOTVS
 */

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

function decodeHTMLEntities(text: string): string {
  return text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function parseFaltasHTML(html: string): { faltas: FaltasItem[] } {
  const itens: FaltasItem[] = [];

  // Encontrar o collapsible "Aviso de frequência"
  const collapsibleMatch = html.match(/<h2[^>]*>Aviso de frequ[^<]*<\/h2>[\s\S]*?<\/ul>/);
  if (!collapsibleMatch) return { faltas: itens };

  const collapsibleContent = collapsibleMatch[0];

  // Encontrar todos os <li> com classe "no-margin"
  const liRegex = /<li class="no-margin">[\s\S]*?<\/li>/g;
  const matches = collapsibleContent.match(liRegex);

  if (!matches) return { faltas: itens };

  matches.forEach((li) => {
    // Extrair código e disciplina do <h3>
    const h3Match = li.match(/<h3[^>]*>(.*?)<\/h3>/);
    if (!h3Match) return;

    const h3Content = h3Match[1].replace(/<[^>]*>/g, '').trim();
    const codigoMatch = h3Content.match(/(\d+-\d+-\d+)\s*\|\s*(.+)/);

    if (!codigoMatch) return;

    const codigo = codigoMatch[1];
    const disciplina = decodeHTMLEntities(codigoMatch[2]);

    // Extrair turma
    const turmaMatch = li.match(/<p>Turma:\s*([^<]+)<\/p>/);
    const turma = turmaMatch ? turmaMatch[1].trim() : '';

    // Extrair situação
    const situacaoMatch = li.match(/<p>Situa&#231;&#227;o:\s*([^<]+)<\/p>/);
    const situacao = situacaoMatch ? decodeHTMLEntities(situacaoMatch[1]) : '';

    // Extrair limite de faltas
    const limiteMatch = li.match(/<p[^>]*>Limite de faltas:\s*([^<]+)<\/p>/);
    const limiteFaltas = limiteMatch ? limiteMatch[1].trim() : '';

    // Extrair porcentagem e cor
    const porcentagemMatch = li.match(/<span class="ui-li-count"(?:\s+style="color:([^"]+)")?[^>]*>([^<]+)<\/span>/);
    const porcentagem = porcentagemMatch ? porcentagemMatch[2].trim() : '';
    const cor = porcentagemMatch && porcentagemMatch[1] ? porcentagemMatch[1] : '#000000';

    // Converter porcentagem para número
    const porcentagemValor = parseFloat(porcentagem.replace(',', '.').replace('%', ''));

    // Determinar status baseado na cor
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

  return { faltas: itens };
}

export async function GET() {
  return fetchTOTVSResponse(
    '/EducaMobile/Educacional/EduAluno/EduAvisos?tp=A',
    parseFaltasHTML,
    '[Faltas]'
  );
}
