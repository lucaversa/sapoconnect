export interface DisciplinaOpcao {
  codigo: string;
  nome: string;
}

export interface Avaliacao {
  nome: string;
  data?: string;
  nota?: string;
  valor?: string;
}

export interface CategoriaComAvaliacoes {
  nome: string;
  avaliacoes: Avaliacao[];
  notaTotal?: number;
  valorTotal?: number;
  porcentagem?: number;
}

export interface ResultadoAvaliacoes {
  categorias: CategoriaComAvaliacoes[];
  somativaGeral?: number;
  mediaParaAprovacao: number;
}

export function decodeHTMLEntities(text: string): string {
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

export function parseNumeric(value?: string): number | null {
  if (!value) return null;
  const parsed = parseFloat(value.replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseDisciplinasHTML(html: string): { disciplinas: DisciplinaOpcao[] } {
  const disciplinas: DisciplinaOpcao[] = [];

  const selectMatch = html.match(/<select[^>]*id="ddlTurmaDisc"[^>]*>([\s\S]*?)<\/select>/);
  if (!selectMatch) {
    return { disciplinas };
  }

  const selectContent = selectMatch[1];
  const optionRegex = /<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/g;
  let match;

  while ((match = optionRegex.exec(selectContent)) !== null) {
    const codigo = match[1];
    let nome = decodeHTMLEntities(match[2]);

    nome = nome.replace(/^\d+-[\d-]+-/, '');

    if (codigo === '-1') continue;

    disciplinas.push({
      codigo,
      nome,
    });
  }

  return { disciplinas };
}

export function parseAvaliacoesHTML(html: string): ResultadoAvaliacoes {
  const categorias: CategoriaComAvaliacoes[] = [];

  const ulMatch = html.match(/<ul[^>]*data-role="listview"[^>]*>([\s\S]*?)<\/ul>/);
  if (!ulMatch) {
    return { categorias, mediaParaAprovacao: 60 };
  }

  const ulContent = ulMatch[1];
  const parts = ulContent.split(/<li[^>]*data-role="list-divider"[^>]*>([^<]+)<\/li>/);

  for (let i = 1; i < parts.length; i += 2) {
    const nomeCategoria = decodeHTMLEntities(parts[i] || '').trim();
    const contentPart = parts[i + 1] || '';

    if (!contentPart) continue;

    const avaliacoesDaCategoria: Avaliacao[] = [];
    let notaTotal = 0;
    let valorTotal = 0;

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

        const notaNum = parseNumeric(notaStr);
        if (notaNum !== null) {
          avaliacao.nota = notaStr;
          notaTotal += notaNum;
        }

        const valorNum = parseNumeric(valorStr);
        if (valorNum !== null) {
          avaliacao.valor = valorStr;
          valorTotal += valorNum;
        }

        avaliacoesDaCategoria.push(avaliacao);
      }
    }

    const porcentagem = valorTotal > 0 ? (notaTotal / valorTotal) * 100 : 0;

    categorias.push({
      nome: nomeCategoria,
      avaliacoes: avaliacoesDaCategoria,
      notaTotal,
      valorTotal,
      porcentagem,
    });
  }

  const categoriasFiltradas = categorias.filter(
    (categoria) => categoria.nome !== 'Nota Parcial' && categoria.nome !== 'Nota Final'
  );

  const notasLancadas = categoriasFiltradas.flatMap((categoria) =>
    categoria.avaliacoes
      .map((avaliacao) => parseNumeric(avaliacao.nota))
      .filter((nota): nota is number => nota !== null)
  );
  const somativaGeral = notasLancadas.reduce((total, nota) => total + nota, 0);

  return {
    categorias: categoriasFiltradas,
    somativaGeral: notasLancadas.length > 0 ? parseFloat(somativaGeral.toFixed(2)) : undefined,
    mediaParaAprovacao: 60,
  };
}
