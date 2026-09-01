import * as cheerio from 'cheerio';

const TOTVS_BASE_URL = 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br';
const FREQUENCY_REVIEW_PATH =
  '/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoesIncluir';

export interface FrequencyReviewDiscipline {
  codigo: string;
  disciplina: string;
}

export interface FrequencyReviewDependency {
  codColigada: string;
  codAplicacao: string;
  codSentencaDependencia: string;
  codParametroDependencia: string;
  nomeParametroDependencia: string;
}

export interface FrequencyReviewForm {
  disciplinas: FrequencyReviewDiscipline[];
  dependencia: FrequencyReviewDependency;
}

export interface FrequencyReviewDate {
  data: string;
  label: string;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeText(value: string): string {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function toFrequencyReviewPath(href: string): string | null {
  try {
    const url = new URL(href, TOTVS_BASE_URL);
    if (url.origin !== TOTVS_BASE_URL || url.pathname !== FREQUENCY_REVIEW_PATH) {
      return null;
    }

    // Preserve the opaque, already encoded TOTVS tokens exactly as supplied.
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function parseFrequencyReviewPath(html: string): string | null {
  const $ = cheerio.load(html);
  let result: string | null = null;

  $('a[href]').each((_, element) => {
    if (result) return;

    const link = $(element);
    const label = normalizeText(link.text());
    if (!label.includes('REVISAO DE FREQUENCIA')) return;

    const href = link.attr('href');
    if (href) result = toFrequencyReviewPath(href);
  });

  return result;
}

function parseDependencyArguments(onChange: string): string[] | null {
  const call = onChange.match(/onChangeCampoParametroDependencia\s*\(([^)]*)\)/i);
  if (!call) return null;

  const args: string[] = [];
  const argumentPattern = /\s*(?:'([^']*)'|"([^"]*)"|([^,]+?))\s*(?:,|$)/g;
  let match: RegExpExecArray | null;

  while ((match = argumentPattern.exec(call[1])) !== null) {
    args.push(cleanText(match[1] ?? match[2] ?? match[3] ?? ''));
  }

  return args.length >= 5 && args.slice(0, 5).every(Boolean) ? args : null;
}

export function parseFrequencyReviewForm(html: string): FrequencyReviewForm | null {
  const $ = cheerio.load(html);
  const requestType = cleanText(
    $('input[name="NOMETIPO"]').attr('value') ?? $('form h1').first().text()
  );
  if (!normalizeText(requestType).includes('REVISAO DE FREQUENCIA')) return null;

  const selects = $('select').toArray();

  const selectByLabel = selects.find((element) => {
    const id = $(element).attr('id');
    if (!id) return false;

    const label = $('label').toArray().find((candidate) => $(candidate).attr('for') === id);
    return label ? normalizeText($(label).text()).includes('DISCIPLINAS PARA REVISAO') : false;
  });
  const disciplineSelect = selectByLabel ?? selects.find((element) =>
    /onChangeCampoParametroDependencia/i.test($(element).attr('onchange') ?? '')
  );

  if (!disciplineSelect) return null;

  const args = parseDependencyArguments($(disciplineSelect).attr('onchange') ?? '');
  if (!args) return null;

  const disciplinas: FrequencyReviewDiscipline[] = [];
  $(disciplineSelect).find('option').each((_, option) => {
    const codigo = cleanText($(option).attr('value') ?? '');
    if (!codigo) return;

    disciplinas.push({
      codigo,
      disciplina: cleanText($(option).text()),
    });
  });

  if (disciplinas.length === 0) return null;

  return {
    disciplinas,
    dependencia: {
      codColigada: args[0],
      codAplicacao: args[1],
      codSentencaDependencia: args[2],
      codParametroDependencia: args[3],
      nomeParametroDependencia: args[4],
    },
  };
}

export function buildFrequencyReviewParameter(
  dependencia: FrequencyReviewDependency,
  codigoDisciplina: string
): string {
  return [
    `${dependencia.codColigada};${dependencia.codAplicacao};${dependencia.codSentencaDependencia}`,
    codigoDisciplina,
    '0',
    dependencia.nomeParametroDependencia.replaceAll(',', ';'),
  ].join('|');
}

function parseBrazilianDate(value: string): FrequencyReviewDate | null {
  const label = cleanText(value);
  const match = label.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return {
    data: `${year}-${month}-${day}`,
    label,
  };
}

export function parseFrequencyReviewDates(payload: unknown): FrequencyReviewDate[] | null {
  if (!Array.isArray(payload)) return null;

  const dates = new Map<string, FrequencyReviewDate>();
  payload.forEach((item) => {
    if (!item || typeof item !== 'object') return;

    const candidate = item as { Value?: unknown; Text?: unknown };
    const parsed = [candidate.Value, candidate.Text]
      .filter((value): value is string => typeof value === 'string')
      .map(parseBrazilianDate)
      .find((value): value is FrequencyReviewDate => value !== null);
    if (parsed) dates.set(parsed.data, parsed);
  });

  if (payload.length > 0 && dates.size === 0) return null;
  return Array.from(dates.values()).sort((a, b) => a.data.localeCompare(b.data));
}
