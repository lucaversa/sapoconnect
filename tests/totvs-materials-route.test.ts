import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => {
  class HTTPError extends Error {
    constructor(message: string, public statusCode: number, public debugCode: string) { super(message); }
  }
  class TotvsContextError extends Error {
    constructor(message: string, public status: number, public code: string) { super(message); }
  }
  class UpstreamTimeoutError extends Error {}
  return { HTTPError, TotvsContextError, UpstreamTimeoutError, getSession: vi.fn(), fetchTOTVSResult: vi.fn(), fetchTotvs: vi.fn(), ensureTotvsContext: vi.fn() };
});
vi.mock('@/lib/session', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/external-auth', () => ({ formatCookiesForRequest: () => 'ASP.NET_SessionId=private;.ASPXAUTH=secret' }));
vi.mock('@/lib/totvs-api', () => ({ HTTPError: mocks.HTTPError, fetchTOTVSResult: mocks.fetchTOTVSResult }));
vi.mock('@/lib/totvs-context', () => ({ TotvsContextError: mocks.TotvsContextError, ensureTotvsContext: mocks.ensureTotvsContext }));
vi.mock('@/lib/server/upstream', () => ({ fetchTotvs: mocks.fetchTotvs, UpstreamTimeoutError: mocks.UpstreamTimeoutError }));

import { GET as materialsGET } from '@/app/api/totvs/materials/route';
import { GET as fileGET } from '@/app/api/totvs/files/route';
import { TOTVS_MATERIALS_ORIGIN, TOTVS_MATERIALS_PATH } from '@/lib/totvs-materials-parser';

const downloadPath = '/EducaMobile/Educacional/EduArquivos/Download/9526?arquivo=202691_6175_aula%2Banestesico.pdf&httproute=True';
const contextPath = '/EducaMobile/Educacional/EduContexto/GetContextoAluno';
const fullShell = readFileSync(new URL('./fixtures/totvs-materials-shell.html', import.meta.url), 'utf8');
const page = (content: string) => `<html><div data-role="header"><h1>Arquivos Disciplina</h1></div><div id="content-main">${content}</div></html>`;
const listing = (path = downloadPath, fileName = 'aula anestésico.pdf') => page(`<div data-role="collapsible"><h3>CLÍNICA CIRÚRGICA I</h3>
  <ul data-role="listview"><li><a href="${path.replaceAll('&', '&amp;')}"><b>aula01</b><span class="ui-li-count">3156 Kb</span><br>01/09/2026 - ${fileName}<br></a></li></ul></div>`);
const request = (id = '9526') => new Request(`http://localhost/api/totvs/files?id=${id}`);
const pdf = () => new Response('%PDF-1.7\nfile data', { headers: { 'Content-Type': 'application/pdf', 'Set-Cookie': 'upstream=private', 'Content-Disposition': 'inline; filename=unsafe.html' } });

describe('TOTVS materials routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockReset().mockResolvedValue({ cacheScope: 'scope-aluno', externalCookies: { aspNetSessionId: 'private', aspxAuth: 'secret' } });
    mocks.fetchTOTVSResult.mockReset().mockResolvedValue({ html: listing(), cache: 'miss' });
    mocks.fetchTotvs.mockReset().mockImplementation(async () => pdf());
    mocks.ensureTotvsContext.mockReset().mockResolvedValue(undefined);
  });

  it('lists and authorizes downloads from a full TOTVS shell with preceding session popup headers', async () => {
    mocks.fetchTOTVSResult.mockResolvedValue({ html: fullShell, cache: 'miss' });
    const response = await materialsGET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.courses).toEqual([{
      id: expect.stringMatching(/^[a-f0-9]{24}$/),
      name: 'CLÍNICA CIRÚRGICA I',
      materials: [{
        id: '9526', title: 'aula01', fileName: 'aula anestesico.pdf', sizeLabel: '3156 Kb',
        publishedAt: '2026-09-01', publishedAtLabel: '01/09/2026', downloadUrl: '/api/totvs/files?id=9526',
      }],
    }]);
    const file = await fileGET(new Request(new URL(body.courses[0].materials[0].downloadUrl, 'http://localhost')));
    expect(file.status).toBe(200);
    expect(await file.text()).toBe('%PDF-1.7\nfile data');
    expect((await fileGET(request('9478'))).status).toBe(404);
    expect(mocks.fetchTotvs).toHaveBeenCalledExactlyOnceWith(TOTVS_MATERIALS_ORIGIN + downloadPath, expect.objectContaining({ redirect: 'manual' }), { idempotentRead: true });
  });

  it('returns an empty list from a truly empty full shell without granting file membership', async () => {
    const emptyShell = fullShell.replace(/<!-- discipline files -->[\s\S]*?<!-- end discipline files -->/, '');
    mocks.fetchTOTVSResult.mockResolvedValue({ html: emptyShell, cache: 'miss' });
    const response = await materialsGET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ courses: [] });
    expect((await fileGET(request())).status).toBe(404);
    expect(mocks.fetchTotvs).not.toHaveBeenCalled();
  });

  it('rejects a wrong main page title even when a popup advertises materials', async () => {
    const wrongPage = fullShell
      .replace('<h1>Arquivos Disciplina</h1>', '<h1>Dados Pessoais</h1>')
      .replace('<h1>Aten&#231;&#227;o</h1>', '<h1>Arquivos Disciplina</h1>');
    mocks.fetchTOTVSResult.mockResolvedValue({ html: wrongPage, cache: 'miss' });
    const response = await materialsGET();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: 'TOTVS_MATERIALS_INVALID' });
    expect((await fileGET(request())).status).toBe(502);
    expect(mocks.fetchTotvs).not.toHaveBeenCalled();
  });

  it('lists public metadata with local download URLs and private cache headers', async () => {
    const response = await materialsGET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
    const body = await response.json();
    expect(body.fetchedAt).toEqual(expect.any(String));
    expect(body.courses[0].materials[0]).toEqual({
      id: '9526', title: 'aula01', fileName: 'aula anestésico.pdf', sizeLabel: '3156 Kb',
      publishedAt: '2026-09-01', publishedAtLabel: '01/09/2026', downloadUrl: '/api/totvs/files?id=9526',
    });
    expect(JSON.stringify(body)).not.toMatch(/upstreamPath|rm\.cloudtotvs|arquivo=|ASPXAUTH/);
    expect(mocks.fetchTOTVSResult).toHaveBeenCalledWith(TOTVS_MATERIALS_PATH, '[TOTVS materiais]');
  });

  it('marks transient cached data and accepts a valid empty page', async () => {
    mocks.fetchTOTVSResult.mockResolvedValue({ html: page(''), cache: 'stale' });
    const response = await materialsGET();
    expect(response.status).toBe(200);
    expect(response.headers.get('x-sapoconnect-cache')).toBe('stale');
    expect(await response.json()).toMatchObject({ courses: [], __cacheStale: true });
  });

  it('recovers a direct context-selection form using a fresh uncached listing request', async () => {
    mocks.fetchTOTVSResult.mockResolvedValue({ html: '<meta name="viewport"><div id="pgContexto"><form id="frmCtx"></form></div>', cache: 'hit' });
    mocks.fetchTotvs.mockResolvedValueOnce(new Response(listing(), { headers: { 'Content-Type': 'text/html' } }));
    const response = await materialsGET();
    expect(response.status).toBe(200);
    expect((await response.json()).courses[0].materials).toHaveLength(1);
    expect(mocks.ensureTotvsContext).toHaveBeenCalledWith(expect.any(String), 'scope-aluno', true);
    expect(mocks.fetchTotvs).toHaveBeenCalledWith(TOTVS_MATERIALS_ORIGIN + TOTVS_MATERIALS_PATH, expect.objectContaining({ redirect: 'manual' }), { idempotentRead: true });
    expect(mocks.fetchTOTVSResult).toHaveBeenCalledTimes(1);
  });

  it('stops after one direct-context recovery and never mistakes it for no files', async () => {
    const context = '<div id="pgContexto"><form id="frmCtx"></form></div>';
    mocks.fetchTOTVSResult.mockResolvedValue({ html: context, cache: 'miss' });
    mocks.fetchTotvs.mockResolvedValueOnce(new Response(context));
    const response = await materialsGET();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: 'CONTEXT_INVALID' });
    expect(mocks.fetchTotvs).toHaveBeenCalledTimes(1);
    expect(mocks.ensureTotvsContext).toHaveBeenCalledTimes(1);
  });

  it('does not follow a foreign redirect while recovering a listing context', async () => {
    mocks.fetchTOTVSResult.mockResolvedValue({ html: '<div id="pgContexto"></div>', cache: 'miss' });
    mocks.fetchTotvs.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'https://evil.example/context' } }));
    expect((await materialsGET()).status).toBe(502);
    expect(mocks.fetchTotvs).toHaveBeenCalledTimes(1);
  });

  it('requires the current student session for both endpoints', async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await materialsGET()).status).toBe(401);
    expect((await fileGET(request())).status).toBe(401);
    expect(mocks.fetchTOTVSResult).not.toHaveBeenCalled();
    expect(mocks.fetchTotvs).not.toHaveBeenCalled();
  });

  it('rejects invalid or unknown IDs without downloading an arbitrary file', async () => {
    expect((await fileGET(request('../../etc/passwd'))).status).toBe(400);
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect((await fileGET(request('123'))).status).toBe(404);
    expect(mocks.fetchTotvs).not.toHaveBeenCalled();
  });

  it('downloads only the listed path, preserves bytes/encoding, and never forwards upstream cookies', async () => {
    const response = await fileGET(new Request('http://localhost/api/totvs/files?id=9526&url=https://evil.example/file'));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('%PDF-1.7\nfile data');
    expect(mocks.fetchTotvs).toHaveBeenCalledWith(TOTVS_MATERIALS_ORIGIN + downloadPath, expect.objectContaining({
      redirect: 'manual',
      headers: expect.objectContaining({ Cookie: 'ASP.NET_SessionId=private;.ASPXAUTH=secret' }),
    }), { idempotentRead: true });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('attachment;');
    expect(response.headers.get('content-disposition')).toContain("filename*=UTF-8''aula%20anest%C3%A9sico.pdf");
    expect(response.headers.get('content-disposition')).not.toContain('unsafe.html');
  });

  it('does not collapse nested percent encoding in file names', async () => {
    const encoded = downloadPath.replace('aula%2Banestesico.pdf', 'Gerente%252bda%252brevista.pdf');
    mocks.fetchTOTVSResult.mockResolvedValue({ html: listing(encoded), cache: 'miss' });
    expect((await fileGET(request())).status).toBe(200);
    expect(mocks.fetchTotvs.mock.calls[0][0]).toBe(TOTVS_MATERIALS_ORIGIN + encoded);
  });

  it.each([contextPath, TOTVS_MATERIALS_ORIGIN + contextPath])('recovers the known context redirect once', async (location) => {
    mocks.fetchTotvs.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: location } })).mockResolvedValueOnce(pdf());
    const response = await fileGET(request());
    expect(response.status).toBe(200);
    expect(mocks.ensureTotvsContext).toHaveBeenNthCalledWith(2, expect.any(String), 'scope-aluno', true);
    expect(mocks.fetchTotvs).toHaveBeenCalledTimes(2);
    expect(mocks.fetchTotvs.mock.calls[1][0]).toBe(TOTVS_MATERIALS_ORIGIN + downloadPath);
  });

  it('recovers Object moved HTML but stops after the single allowed context replay', async () => {
    const html = `<html><h2>Object moved to <a href="${contextPath}">here</a></h2></html>`;
    mocks.fetchTotvs.mockImplementation(async () => new Response(html, { headers: { 'Content-Type': 'text/html' } }));
    const response = await fileGET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: 'CONTEXT_INVALID' });
    expect(mocks.fetchTotvs).toHaveBeenCalledTimes(2);
    expect(mocks.ensureTotvsContext).toHaveBeenCalledTimes(2);
  });

  it('accepts a successful file after an Object moved recovery', async () => {
    mocks.fetchTotvs.mockResolvedValueOnce(new Response(`<html>Object moved <a href="${contextPath}">here</a></html>`, { headers: { 'Content-Type': 'text/html' } })).mockResolvedValueOnce(pdf());
    const response = await fileGET(request());
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('%PDF');
  });

  it('detects context HTML beginning with meta even when mislabeled as binary', async () => {
    mocks.fetchTotvs.mockResolvedValueOnce(new Response('<meta name="viewport"><div id="pgContexto"><form id="frmCtx"></form></div>', { headers: { 'Content-Type': 'application/octet-stream' } })).mockResolvedValueOnce(pdf());
    expect((await fileGET(request())).status).toBe(200);
    expect(mocks.ensureTotvsContext).toHaveBeenCalledTimes(2);
  });

  it('detects login HTML beginning with div even when mislabeled as binary', async () => {
    mocks.fetchTotvs.mockResolvedValueOnce(new Response('<div><form><input type="password"></form></div>', { headers: { 'Content-Type': 'application/octet-stream' } }));
    expect((await fileGET(request())).status).toBe(401);
    expect(mocks.fetchTotvs).toHaveBeenCalledTimes(1);
  });

  it.each([
    'https://evil.example/file.pdf', '//evil.example' + downloadPath,
    '/EducaMobile/Home/Index', downloadPath.replace('/9526?', '/9527?'),
    TOTVS_MATERIALS_ORIGIN + '.evil.example' + downloadPath,
  ])('rejects redirects outside the listed file endpoint before sending cookies (%s)', async (location) => {
    mocks.fetchTotvs.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: location } }));
    expect((await fileGET(request())).status).toBe(502);
    expect(mocks.fetchTotvs).toHaveBeenCalledTimes(1);
  });

  it('allows only a bounded sequence of same-origin download redirects', async () => {
    mocks.fetchTotvs.mockImplementation(async () => new Response(null, { status: 302, headers: { Location: TOTVS_MATERIALS_ORIGIN + downloadPath } }));
    const response = await fileGET(request());
    expect(response.status).toBe(502);
    expect(mocks.fetchTotvs).toHaveBeenCalledTimes(4);
  });

  it('maps login redirects and login HTML to session expiration', async () => {
    mocks.fetchTotvs.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: '/EducaMobile/Account/Login' } }));
    expect((await fileGET(request())).status).toBe(401);
    mocks.fetchTotvs.mockResolvedValueOnce(new Response('<form><input type="password"></form>', { headers: { 'Content-Type': 'text/html' } }));
    expect((await fileGET(request())).status).toBe(401);
  });

  it.each([
    ['<html><script>alert(1)</script></html>', 'application/octet-stream'],
    ['<!-- comment --> <html>not a file</html>', 'application/octet-stream'],
    ['<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'image/svg+xml'],
    ['<html>Erro no servidor</html>', 'text/html'],
    ['<div>Não é um arquivo</div>', 'application/octet-stream'],
    ['', 'application/pdf'],
  ])('rejects active content or empty bodies disguised as files', async (body, type) => {
    mocks.fetchTotvs.mockResolvedValueOnce(new Response(body, { headers: { 'Content-Type': type } }));
    const response = await fileGET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: 'TOTVS_FILE_INVALID' });
  });

  it('keeps Office Open XML attachments downloadable', async () => {
    mocks.fetchTotvs.mockResolvedValueOnce(new Response('PK archive data', { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }));
    const response = await fileGET(request());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('PK archive data');
  });

  it('preserves binary bytes across the sniff prefix and the remaining stream', async () => {
    const first = new Uint8Array(20_000).fill(37);
    const second = new Uint8Array([0, 255, 128, 10, 42]);
    mocks.fetchTotvs.mockResolvedValueOnce(new Response(new ReadableStream({
      start(controller) { controller.enqueue(first); controller.enqueue(second); controller.close(); },
    }), { headers: { 'Content-Type': 'application/pdf' } }));
    const response = await fileGET(request());
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes).toEqual(new Uint8Array([...Array.from(first), ...Array.from(second)]));
  });

  it('does not serve malformed listing HTML as an empty list or membership grant', async () => {
    mocks.fetchTOTVSResult.mockResolvedValue({ html: '<html>schema changed</html>', cache: 'miss' });
    expect((await materialsGET()).status).toBe(502);
    expect((await fileGET(request())).status).toBe(502);
    expect(mocks.fetchTotvs).not.toHaveBeenCalled();
  });

  it('preserves explicit upstream errors and timeout codes', async () => {
    mocks.fetchTOTVSResult.mockRejectedValueOnce(new mocks.HTTPError('Sessão expirada.', 401, 'SESSION_EXPIRED'));
    expect((await materialsGET()).status).toBe(401);
    mocks.fetchTotvs.mockRejectedValueOnce(new mocks.UpstreamTimeoutError());
    expect((await fileGET(request())).status).toBe(504);
    mocks.ensureTotvsContext.mockRejectedValueOnce(new mocks.TotvsContextError('Período inválido.', 502, 'CONTEXT_INVALID'));
    expect((await fileGET(request())).status).toBe(502);
  });

  it('returns an upstream timeout when the binary body times out after response headers', async () => {
    mocks.fetchTotvs.mockResolvedValueOnce(new Response(new ReadableStream({
      pull(controller) { controller.error(new DOMException('The operation timed out.', 'TimeoutError')); },
    }), { headers: { 'Content-Type': 'application/pdf' } }));
    const response = await fileGET(request());
    expect(response.status).toBe(504);
    expect(response.headers.get('cache-control')).toContain('private, no-store');
    expect(await response.json()).toEqual({ error: 'Tempo de espera do EduConnect esgotado.', code: 'UPSTREAM_TIMEOUT' });
  });

  it('returns an upstream timeout when the recovered listing body times out after response headers', async () => {
    mocks.fetchTOTVSResult.mockResolvedValue({ html: '<div id="pgContexto"><form id="frmCtx"></form></div>', cache: 'miss' });
    mocks.fetchTotvs.mockResolvedValueOnce(new Response(new ReadableStream({
      pull(controller) { controller.error(new DOMException('The operation timed out.', 'TimeoutError')); },
    }), { headers: { 'Content-Type': 'text/html' } }));
    const response = await materialsGET();
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    expect(mocks.ensureTotvsContext).toHaveBeenCalledTimes(1);
  });
});
