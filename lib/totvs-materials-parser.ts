import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import type { TotvsMaterial } from '@/lib/totvs-materials-types';

export const TOTVS_MATERIALS_ORIGIN = 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br';
export const TOTVS_MATERIALS_PATH = '/EducaMobile/Educacional/EduMateriais/EduArquivosDisciplina?tp=A';

export interface ParsedTotvsMaterial extends Omit<TotvsMaterial, 'downloadUrl'> {
  upstreamPath: string;
}

export interface ParsedTotvsMaterialsCourse {
  id: string;
  name: string;
  materials: ParsedTotvsMaterial[];
}

export class TotvsMaterialsParseError extends Error {
  constructor(
    message = 'Não foi possível interpretar os materiais do EduConnect.',
    public code = 'TOTVS_MATERIALS_INVALID',
    public status = 502,
  ) {
    super(message);
    this.name = 'TotvsMaterialsParseError';
  }
}

function text(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeName(value: string): string {
  return text(value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')).toLowerCase();
}

/** Validate without re-encoding the arquivo value (TOTVS uses nested percent escapes). */
export function parseTotvsDownloadPath(href: string): { id: string; upstreamPath: string } {
  const rawPath = href.startsWith(TOTVS_MATERIALS_ORIGIN + '/')
    ? href.slice(TOTVS_MATERIALS_ORIGIN.length)
    : href;
  const match = rawPath.match(/^\/EducaMobile\/Educacional\/EduArquivos\/Download\/([1-9]\d{0,15})\?([^#]+)$/);
  if (!match || href.length > 4_000 || /[\s\\\u0000-\u001f\u007f]/.test(href)) {
    throw new TotvsMaterialsParseError('Link de arquivo inválido no EduConnect.', 'TOTVS_FILE_LINK_INVALID');
  }
  const url = new URL(rawPath, TOTVS_MATERIALS_ORIGIN);
  const names = Array.from(url.searchParams.keys());
  const fileName = url.searchParams.get('arquivo');
  if (
    names.some((name) => name !== 'arquivo' && name !== 'httproute') ||
    url.searchParams.getAll('arquivo').length !== 1 ||
    url.searchParams.getAll('httproute').length > 1 ||
    !fileName || /[\u0000-\u001f\u007f/\\]/.test(fileName)
  ) {
    throw new TotvsMaterialsParseError('Link de arquivo inválido no EduConnect.', 'TOTVS_FILE_LINK_INVALID');
  }
  return { id: match[1], upstreamPath: rawPath };
}

export function classifyTotvsMaterialsHtml(html: string): 'context' | 'login' | null {
  const $ = cheerio.load(html);
  if ($('#pgContexto, #frmCtx, form[action*="SetContextoAluno"]').length ||
    (/Object moved/i.test(html) && $('a[href*="GetContextoAluno"]').length)) {
    return 'context';
  }
  if ($('input[type="password"], form[action*="/Account/Login"], form[action*="LoginExterno"]').length ||
    (/Object moved/i.test(html) && $('a[href*="/Account/Login"], a[href*="LoginExterno"]').length)) {
    return 'login';
  }
  return null;
}

function parseDate(label: string): string | null {
  const match = label.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

export function parseTotvsMaterials(html: string): ParsedTotvsMaterialsCourse[] {
  const pageKind = classifyTotvsMaterialsHtml(html);
  if (pageKind === 'login') {
    throw new TotvsMaterialsParseError('Sessão expirada no EduConnect.', 'SESSION_EXPIRED', 401);
  }
  if (pageKind === 'context') {
    throw new TotvsMaterialsParseError('Não foi possível selecionar o período do EduConnect.', 'CONTEXT_INVALID');
  }
  const $ = cheerio.load(html);
  const content = $('#content-main');
  const page = content.closest('[data-role="page"]');
  const container = page.length ? page : content.parent();
  // Session popups precede the page and have their own "Atenção" headers.
  // Only the direct page header identifies the content being parsed.
  const title = normalizeName(container.children('[data-role="header"]').children('h1').first().text());
  if (content.length !== 1 || !/^arquivos (?:de )?disciplinas?$/.test(title)) {
    throw new TotvsMaterialsParseError();
  }
  const groups = content.find('[data-role="collapsible"]');
  if (!groups.length && text(content.text()) && !/nenhum (?:registro|arquivo|material)/i.test(content.text())) {
    throw new TotvsMaterialsParseError();
  }

  const courses = new Map<string, ParsedTotvsMaterialsCourse>();
  const knownLinks = new Map<string, string>();
  groups.each((_, group) => {
    const name = text($(group).children('h3').first().text());
    if (!name) throw new TotvsMaterialsParseError();
    const id = createHash('sha256').update(normalizeName(name)).digest('hex').slice(0, 24);
    const course = courses.get(id) ?? { id, name, materials: [] };
    const anchors = $(group).find('ul[data-role="listview"] a');
    if (!anchors.length && $(group).find('li').length) throw new TotvsMaterialsParseError();
    anchors.each((_, anchor) => {
      const link = $(anchor);
      const { id: fileId, upstreamPath } = parseTotvsDownloadPath(link.attr('href') ?? '');
      const previous = knownLinks.get(fileId);
      if (previous && previous !== upstreamPath) throw new TotvsMaterialsParseError();
      knownLinks.set(fileId, upstreamPath);
      if (course.materials.some((item) => item.id === fileId)) return;
      const title = text(link.find('b').first().text());
      const sizeLabel = text(link.find('.ui-li-count').first().text());
      const description = link.clone();
      description.find('b, .ui-li-count, img, script, style').remove();
      description.find('br').replaceWith('\n');
      const detail = text(description.text());
      const dateMatch = detail.match(/^(\d{2}\/\d{2}\/\d{4})\s*-\s*(.+)$/);
      const publishedAt = dateMatch ? parseDate(dateMatch[1]) : null;
      const fileName = dateMatch ? text(dateMatch[2]) : detail;
      if (!fileName || (dateMatch && !publishedAt)) throw new TotvsMaterialsParseError();
      course.materials.push({
        id: fileId,
        title: title || fileName,
        fileName,
        sizeLabel,
        publishedAt,
        publishedAtLabel: publishedAt && dateMatch ? dateMatch[1] : null,
        upstreamPath,
      });
    });
    courses.set(id, course);
  });
  return Array.from(courses.values());
}
