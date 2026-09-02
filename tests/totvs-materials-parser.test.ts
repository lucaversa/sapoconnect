import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  classifyTotvsMaterialsHtml,
  parseTotvsDownloadPath,
  parseTotvsMaterials,
  TOTVS_MATERIALS_ORIGIN,
} from '@/lib/totvs-materials-parser';

const encodedPath = '/EducaMobile/Educacional/EduArquivos/Download/9526?arquivo=202691_6175_aula%2Banestesico.pdf&httproute=True';
const secondPath = '/EducaMobile/Educacional/EduArquivos/Download/9478?arquivo=2026821_20225_Gerente%252bda%252brevista%252c%252b4.pdf&httproute=True';
const fullShell = readFileSync(new URL('./fixtures/totvs-materials-shell.html', import.meta.url), 'utf8');
const item = (path: string, title = 'aula01', detail = '01/09/2026 - aula anestesico.pdf') => `
  <ul data-role="listview"><li><a href="${path.replaceAll('&', '&amp;')}">
    <img alt="Download"><b>${title}</b><span class="ui-li-count">3156 Kb</span><br>${detail}<br>
  </a></li></ul>`;
const group = (name: string, children: string) => `<div data-role="collapsible"><h3>${name}</h3>${children}</div>`;
const page = (content: string) => `<!DOCTYPE html><html><body>
  <div data-role="header"><h1>Arquivos Disciplina</h1></div>
  <script>var urlLogin = '/EducaMobile/Account/Login';</script>
  <div id="content-main">${content}</div>
  <div id="left-panel"><div data-role="collapsible"><h4>Materiais</h4><a href="/menu">Disciplina</a></div></div>
  </body></html>`;

describe('TOTVS materials parser', () => {
  it('parses the full TOTVS shell using the main page title rather than preceding session popup titles', () => {
    expect(classifyTotvsMaterialsHtml(fullShell)).toBeNull();
    const courses = parseTotvsMaterials(fullShell);
    expect(courses).toHaveLength(1);
    expect(courses[0]).toEqual({
      id: expect.stringMatching(/^[a-f0-9]{24}$/),
      name: 'CLÍNICA CIRÚRGICA I',
      materials: [{
        id: '9526', title: 'aula01', fileName: 'aula anestesico.pdf', sizeLabel: '3156 Kb',
        publishedAt: '2026-09-01', publishedAtLabel: '01/09/2026', upstreamPath: encodedPath,
      }],
    });
  });

  it('accepts a truly empty full shell despite global session warnings and sidebar groups', () => {
    const emptyShell = fullShell.replace(/<!-- discipline files -->[\s\S]*?<!-- end discipline files -->/, '');
    expect(parseTotvsMaterials(emptyShell)).toEqual([]);
  });

  it('rejects a wrong main page title even when a preceding popup has the materials title', () => {
    const wrongPage = fullShell
      .replace('<h1>Arquivos Disciplina</h1>', '<h1>Dados Pessoais</h1>')
      .replace('<h1>Aten&#231;&#227;o</h1>', '<h1>Arquivos Disciplina</h1>');
    expect(() => parseTotvsMaterials(wrongPage)).toThrow(expect.objectContaining({ code: 'TOTVS_MATERIALS_INVALID' }));
  });

  it('extracts the supplied discipline-file format without treating menu groups as courses', () => {
    const [course] = parseTotvsMaterials(page(group('CL&#205;NICA CIR&#218;RGICA I', item(encodedPath))));
    expect(course.id).toMatch(/^[a-f0-9]{24}$/);
    expect(course.name).toBe('CLÍNICA CIRÚRGICA I');
    expect(course.materials).toEqual([{
      id: '9526', title: 'aula01', fileName: 'aula anestesico.pdf', sizeLabel: '3156 Kb',
      publishedAt: '2026-09-01', publishedAtLabel: '01/09/2026', upstreamPath: encodedPath,
    }]);
  });

  it('keeps encoded plus and double-encoded values byte-for-byte', () => {
    expect(parseTotvsDownloadPath(encodedPath).upstreamPath).toBe(encodedPath);
    expect(parseTotvsDownloadPath(secondPath).upstreamPath).toBe(secondPath);
    expect(parseTotvsDownloadPath(TOTVS_MATERIALS_ORIGIN + secondPath).upstreamPath).toBe(secondPath);
    const [course] = parseTotvsMaterials(page(group('CLÍNICA CIRÚRGICA I', item(secondPath, 'complementar', '21/08/2026 - Gerente+da+revista,+4.pdf'))));
    expect(course.materials[0].fileName).toBe('Gerente+da+revista,+4.pdf');
    expect(course.materials[0].upstreamPath).toBe(secondPath);
  });

  it('keeps course IDs stable when files, case, accents, or order change', () => {
    const [before] = parseTotvsMaterials(page(group('CLÍNICA CIRÚRGICA I', item(encodedPath))));
    const [after] = parseTotvsMaterials(page(group('  clinica   cirurgica i ', item(secondPath) + item(encodedPath))));
    const [otherLevel] = parseTotvsMaterials(page(group('CLÍNICA CIRÚRGICA II', item(encodedPath))));
    expect(after.id).toBe(before.id);
    expect(otherLevel.id).not.toBe(before.id);
  });

  it('deduplicates repeated links within a discipline, not separately identified files', () => {
    const [course] = parseTotvsMaterials(page(group('CLÍNICA I', item(encodedPath) + item(encodedPath) + item(secondPath))));
    expect(course.materials.map((material) => material.id)).toEqual(['9526', '9478']);
  });

  it('accepts a truly empty known page and explicit no-records page', () => {
    expect(parseTotvsMaterials(page(''))).toEqual([]);
    expect(parseTotvsMaterials(page('<p>Nenhum registro encontrado.</p>'))).toEqual([]);
  });

  it('allows a missing publication date without inventing one', () => {
    const [course] = parseTotvsMaterials(page(group('CLÍNICA I', item(encodedPath, '', 'anestesico.pdf'))));
    expect(course.materials[0]).toMatchObject({ title: 'anestesico.pdf', publishedAt: null, publishedAtLabel: null });
  });

  it.each([
    '', '<html>unexpected response</html>',
    '<div id="content-main"></div>',
    page('<p>Schema changed</p>'),
    page(group('', item(encodedPath))),
    page(group('CLÍNICA I', item(encodedPath, 'aula', '31/02/2026 - invalid.pdf'))),
    page(group('CLÍNICA I', item(encodedPath, 'aula', ''))),
    page(group('CLÍNICA I', item(encodedPath) + item(encodedPath.replace('anestesico', 'other')))),
  ])('rejects malformed source rather than returning an empty success (%s)', (html) => {
    expect(() => parseTotvsMaterials(html)).toThrow();
  });

  it.each([
    '<html><h2>Object moved to <a href="/EducaMobile/Educacional/EduContexto/GetContextoAluno">here</a></h2></html>',
    '<div id="pgContexto"><form id="frmCtx" action="/EducaMobile/Educacional/EduContexto/SetContextoAluno"></form></div>',
  ])('rejects unresolved period-selection responses', (html) => {
    expect(() => parseTotvsMaterials(html)).toThrow(expect.objectContaining({ code: 'CONTEXT_INVALID' }));
  });

  it.each([
    '<form action="/EducaMobile/Account/Login"><input type="password"></form>',
    '<h2>Object moved <a href="/EducaMobile/Account/Login">here</a></h2>',
  ])('identifies actual login pages as expired sessions', (html) => {
    expect(() => parseTotvsMaterials(html)).toThrow(expect.objectContaining({ code: 'SESSION_EXPIRED', status: 401 }));
  });

  it.each([
    'https://evil.example' + encodedPath,
    '//evil.example' + encodedPath,
    TOTVS_MATERIALS_ORIGIN + '.evil.example' + encodedPath,
    TOTVS_MATERIALS_ORIGIN + ':444' + encodedPath,
    'http://' + TOTVS_MATERIALS_ORIGIN.slice(8) + encodedPath,
    encodedPath.replace('/Download/', '/Delete/'),
    encodedPath.replace('/Download/', '/other/../Download/'),
    encodedPath.replace('arquivo=', 'url='),
    encodedPath + '&arquivo=another.pdf',
    encodedPath + '#fragment',
    encodedPath.replace('anestesico.pdf', 'anestesico%0d%0aInjected.pdf'),
    encodedPath.replace('anestesico.pdf', '..%2Fsecret.pdf'),
  ])('rejects non-allowlisted download URLs (%s)', (href) => {
    expect(() => parseTotvsDownloadPath(href)).toThrow();
    expect(() => parseTotvsMaterials(page(group('CLÍNICA I', item(href))))).toThrow();
  });
});
