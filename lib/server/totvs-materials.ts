import 'server-only';
import { getSession, type SessionData } from '@/lib/session';
import { formatCookiesForRequest } from '@/lib/external-auth';
import { fetchTOTVSResult, HTTPError } from '@/lib/totvs-api';
import { ensureTotvsContext, TotvsContextError } from '@/lib/totvs-context';
import {
  classifyTotvsMaterialsHtml,
  parseTotvsDownloadPath,
  parseTotvsMaterials,
  TOTVS_MATERIALS_ORIGIN,
  TOTVS_MATERIALS_PATH,
  TotvsMaterialsParseError,
} from '@/lib/totvs-materials-parser';
import type { TotvsMaterialsOverview } from '@/lib/totvs-materials-types';
import { PRIVATE_NO_STORE, privateJson } from '@/lib/server/http';
import { fetchTotvs, UpstreamTimeoutError } from '@/lib/server/upstream';

const CONTEXT_PATH = '/EducaMobile/Educacional/EduContexto/GetContextoAluno';
const MAX_REDIRECTS = 3;
const SNIFF_BYTES = 16_384;

async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session?.externalCookies) {
    throw new HTTPError('Sessão não encontrada. Faça login novamente.', 401, 'SESSION_MISSING');
  }
  return session;
}

async function loadMaterialsSource(session: SessionData) {
  const result = await fetchTOTVSResult(TOTVS_MATERIALS_PATH, '[TOTVS materiais]');
  if (classifyTotvsMaterialsHtml(result.html) === 'context' && !/Object moved/i.test(result.html)) {
    const cookieHeader = formatCookiesForRequest(session.externalCookies);
    await ensureTotvsContext(cookieHeader, session.cacheScope, true);
    // Bypass the HTML cache, which may hold the unresolved selection form.
    const response = await fetchTotvs(`${TOTVS_MATERIALS_ORIGIN}${TOTVS_MATERIALS_PATH}`, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Cookie: cookieHeader,
        Accept: 'text/html,application/xhtml+xml',
        Referer: `${TOTVS_MATERIALS_ORIGIN}/EducaMobile/Home/Index`,
      },
    }, { idempotentRead: true });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => {});
      const kind = redirectKind(response.headers.get('location') ?? '');
      if (kind === 'login') throw new HTTPError('Sessão expirada no EduConnect.', 401, 'SESSION_EXPIRED');
      throw new HTTPError('Não foi possível selecionar o período do EduConnect.', 502, 'CONTEXT_INVALID');
    }
    assertResponseStatus(response);
    return { courses: parseTotvsMaterials(await response.text()), cache: 'miss' as const };
  }
  return { courses: parseTotvsMaterials(result.html), cache: result.cache };
}

export async function getTotvsMaterialsOverview(): Promise<TotvsMaterialsOverview> {
  const session = await requireSession();
  const { courses, cache } = await loadMaterialsSource(session);
  return {
    courses: courses.map((course) => ({
      id: course.id,
      name: course.name,
      materials: course.materials.map((material) => ({
        id: material.id,
        title: material.title,
        fileName: material.fileName,
        sizeLabel: material.sizeLabel,
        publishedAt: material.publishedAt,
        publishedAtLabel: material.publishedAtLabel,
        downloadUrl: `/api/totvs/files?id=${material.id}`,
      })),
    })),
    fetchedAt: new Date().toISOString(),
    ...(cache === 'stale' ? { __cacheStale: true } : {}),
  };
}

function assertResponseStatus(response: Response): void {
  if (response.ok) return;
  if (response.status === 401 || response.status === 403) {
    throw new HTTPError('Sessão expirada no EduConnect.', 401, 'SESSION_EXPIRED');
  }
  if (response.status >= 500 || response.status === 429) {
    throw new HTTPError('Sistema do EduConnect possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
  }
  throw new HTTPError('Não foi possível baixar o arquivo do EduConnect.', 502, 'UPSTREAM_ERROR');
}

function safeAttachment(fileName: string): string {
  const name = fileName.replace(/[\u0000-\u001f\u007f/\\]/g, '_').slice(0, 240) || 'arquivo';
  const ascii = name.normalize('NFKD').replace(/[^\x20-\x7e]|[";]/g, '_');
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function redirectKind(location: string): 'context' | 'login' | null {
  let url: URL;
  try { url = new URL(location, TOTVS_MATERIALS_ORIGIN); } catch { return null; }
  if (url.origin !== TOTVS_MATERIALS_ORIGIN || url.username || url.password) return null;
  if (url.pathname === CONTEXT_PATH) return 'context';
  if (/\/Account\/Login|LoginExterno/i.test(url.pathname)) return 'login';
  return null;
}

async function sniffBody(response: Response) {
  if (!response.body) throw new HTTPError('Arquivo vazio no EduConnect.', 502, 'TOTVS_FILE_INVALID');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (length < SNIFF_BYTES) {
      const next = await reader.read();
      if (next.done) break;
      chunks.push(next.value);
      length += next.value.length;
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  if (length === 0) {
    await reader.cancel().catch(() => {});
    throw new HTTPError('Arquivo vazio no EduConnect.', 502, 'TOTVS_FILE_INVALID');
  }
  const prefix = new Uint8Array(Math.min(length, SNIFF_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, prefix.length - offset);
    prefix.set(part, offset);
    offset += part.length;
    if (offset === prefix.length) break;
  }
  return { reader, chunks, text: new TextDecoder().decode(prefix) };
}

export async function getTotvsMaterialFile(id: string): Promise<Response> {
  if (!/^[1-9]\d{0,15}$/.test(id)) {
    throw new HTTPError('Arquivo inválido.', 400, 'BAD_REQUEST');
  }
  const session = await requireSession();
  const { courses } = await loadMaterialsSource(session);
  const material = courses.flatMap((course) => course.materials).find((item) => item.id === id);
  if (!material) throw new HTTPError('Arquivo não disponível para este aluno.', 404, 'TOTVS_FILE_NOT_FOUND');
  // The caller can only select a listed ID; source paths never come from request parameters.
  const originalPath = parseTotvsDownloadPath(material.upstreamPath).upstreamPath;
  const cookieHeader = formatCookiesForRequest(session.externalCookies);
  await ensureTotvsContext(cookieHeader, session.cacheScope);
  let targetPath = originalPath;
  let redirects = 0;
  let contextRecovered = false;

  for (;;) {
    const response = await fetchTotvs(`${TOTVS_MATERIALS_ORIGIN}${targetPath}`, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Cookie: cookieHeader,
        Accept: '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        Referer: `${TOTVS_MATERIALS_ORIGIN}${TOTVS_MATERIALS_PATH}`,
      },
    }, { idempotentRead: true });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel().catch(() => {});
      const location = response.headers.get('location') ?? '';
      const kind = redirectKind(location);
      if (kind === 'login') throw new HTTPError('Sessão expirada no EduConnect.', 401, 'SESSION_EXPIRED');
      if (kind === 'context' && !contextRecovered) {
        contextRecovered = true;
        await ensureTotvsContext(cookieHeader, session.cacheScope, true);
        targetPath = originalPath;
        continue;
      }
      if (kind === 'context') throw new HTTPError('Não foi possível selecionar o período do EduConnect.', 502, 'CONTEXT_INVALID');
      const next = parseTotvsDownloadPath(location);
      if (next.id !== id || redirects >= MAX_REDIRECTS) {
        throw new HTTPError('Redirecionamento de arquivo inválido no EduConnect.', 502, 'TOTVS_FILE_REDIRECT_INVALID');
      }
      redirects += 1;
      targetPath = next.upstreamPath;
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      assertResponseStatus(response);
    }
    const sample = await sniffBody(response);
    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? 'application/octet-stream';
    const looksActive = /^\s*(?:<!--[\s\S]*?-->\s*)*(?:<!doctype\s+html|<(?:html|head|body|h[1-6]|form|svg|script|div|meta|link|style|title|a)\b|<\?xml\b)/i.test(sample.text);
    const activeType = /^(?:text\/(?:html|xml|javascript|ecmascript)|application\/(?:xml|javascript|ecmascript))$|\+xml$/i.test(contentType);
    const kind = classifyTotvsMaterialsHtml(sample.text);
    if (kind || looksActive || activeType || /\.(?:html?|svg|xml|[cm]?js)$/i.test(material.fileName)) {
      await sample.reader.cancel().catch(() => {});
      if (kind === 'login') throw new HTTPError('Sessão expirada no EduConnect.', 401, 'SESSION_EXPIRED');
      if (kind === 'context' && !contextRecovered) {
        contextRecovered = true;
        await ensureTotvsContext(cookieHeader, session.cacheScope, true);
        targetPath = originalPath;
        continue;
      }
      throw new HTTPError('O EduConnect não retornou um arquivo válido.', 502, kind === 'context' ? 'CONTEXT_INVALID' : 'TOTVS_FILE_INVALID');
    }

    const headers = new Headers(PRIVATE_NO_STORE);
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', safeAttachment(material.fileName));
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Security-Policy', "sandbox; default-src 'none'");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { for (const chunk of sample.chunks) controller.enqueue(chunk); },
      async pull(controller) {
        try {
          const next = await sample.reader.read();
          if (next.done) controller.close();
          else controller.enqueue(next.value);
        } catch (error) { controller.error(error); }
      },
      cancel(reason) { return sample.reader.cancel(reason); },
    });
    return new Response(stream, { status: 200, headers });
  }
}

export function totvsMaterialsRouteError(error: unknown): Response {
  if (error instanceof HTTPError) return privateJson({ error: error.message, code: error.debugCode }, { status: error.statusCode });
  if (error instanceof TotvsContextError || error instanceof TotvsMaterialsParseError) {
    return privateJson({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof UpstreamTimeoutError || (error instanceof DOMException && error.name === 'TimeoutError')) {
    return privateJson({ error: 'Tempo de espera do EduConnect esgotado.', code: 'UPSTREAM_TIMEOUT' }, { status: 504 });
  }
  if (error instanceof TypeError) {
    return privateJson({ error: 'Sistema do EduConnect possivelmente fora do ar.', code: 'TOTVS_OFFLINE' }, { status: 503 });
  }
  return privateJson({ error: 'Erro ao buscar materiais.', code: 'INTERNAL_ERROR' }, { status: 500 });
}
