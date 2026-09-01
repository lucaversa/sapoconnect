/* global self, caches, fetch, URL, Request, Response */

const SHELL_CACHE = 'sapoconnect-shell-v5';
const STATIC_CACHE = 'sapoconnect-static-v5';
const CACHE_PREFIX = 'sapoconnect-';
const LITE_STATE_KEY = '/__sapoconnect-lite-state';
const LITE_MARKER = 'data-sapoconnect-lite';
const SERVICE_WORKER_VERSION = 5;
const SERVICE_WORKER_VERSION_REQUEST = 'SAPOCONNECT_SW_VERSION';
const SERVICE_WORKER_ARM_LITE_REQUEST = 'SAPOCONNECT_SW_ARM_LITE';
const SERVICE_WORKER_ARM_LITE_ACK = 'SAPOCONNECT_SW_ARM_LITE_ACK';
const SHELL_ROUTES = [
  '/',
  '/login',
  '/app',
  '/app/ava',
  '/app/calendario',
  '/app/avaliacoes',
  '/app/faltas',
  '/app/historico',
  '/app/atualizacoes',
];
const CORE_ASSETS = [
  '/manifest.webmanifest',
  '/brand/sapoconnect-icon-96.png',
  '/brand/sapoconnect-icon-192.png',
  '/brand/sapoconnect-icon-512.png',
];
let liteFailClosed = false;

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/brand/')
    || url.pathname === '/manifest.webmanifest'
    || url.pathname === '/favicon.ico'
    || url.pathname === '/icon.png'
    || url.pathname === '/apple-icon.png';
}

async function cacheResponse(cache, request, response) {
  if (response.ok && response.type !== 'opaque') {
    await cache.put(request, response.clone());
  }
  return response;
}

function liteOfflineResponse() {
  return new Response(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#07120b">
    <title>SapoConnect Lite</title>
    <style>
      :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#07120b;color:#eef7f0;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(100%,420px);padding:28px;border:1px solid #ffffff1f;border-radius:28px;background:#ffffff0d;box-shadow:0 24px 72px #0008}.eyebrow{margin:0;color:#78da91;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{margin:12px 0 8px;font-size:28px;letter-spacing:-.04em}p{margin:0;color:#c8d4ca;line-height:1.6}.dot{display:inline-block;width:9px;height:9px;margin-right:8px;border-radius:999px;background:#78da91;box-shadow:0 0 18px #78da91}</style>
  </head>
  <body data-sapoconnect-lite="offline">
    <main class="card">
      <p class="eyebrow"><span class="dot"></span>SapoConnect Lite</p>
      <h1>Conecte-se para continuar</h1>
      <p>O acesso Lite e o tempo diário precisam ser validados com segurança pelo servidor.</p>
    </main>
  </body>
</html>`, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function markLiteState(cache) {
  liteFailClosed = true;
  const cachedRequests = await cache.keys();
  await Promise.allSettled(cachedRequests
    .filter((request) => new URL(request.url).pathname !== LITE_STATE_KEY)
    .map((request) => cache.delete(request)));
  await cache.put(LITE_STATE_KEY, new Response('active'));
}

async function clearLiteStateAfterNormalDocument(cache, pathname, response) {
  // Persist the normal document first. If this write is interrupted, the
  // previous Lite state remains closed instead of exposing another shell.
  await cache.put(pathname, response.clone());
  await cache.delete(LITE_STATE_KEY);
  liteFailClosed = false;
}

async function classifyNavigationResponse(cache, pathname, response) {
  if (!response.ok || response.type === 'opaque') return null;
  if (!response.headers.get('content-type')?.includes('text/html')) return null;

  const html = await response.clone().text();
  if (html.includes(LITE_MARKER)) {
    // Lite HTML is personalized and time-sensitive. Never store it under a
    // route pathname or as an offline document.
    await markLiteState(cache);
    return 'lite';
  }

  await clearLiteStateAfterNormalDocument(cache, pathname, response);
  return 'normal';
}

async function hasLiteState(cache) {
  if (liteFailClosed) return true;
  return Boolean(await cache.match(LITE_STATE_KEY));
}

async function precacheNormalShell(pathname) {
  const shellCache = await caches.open(SHELL_CACHE);
  const request = new Request(pathname, { cache: 'reload', credentials: 'same-origin' });
  const response = await fetch(request);
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return;

  const html = await response.clone().text();
  // A Lite document is personalized and expiring, so installation must not
  // persist it or use it to mutate the account-state marker.
  if (html.includes(LITE_MARKER)) return;
  await shellCache.put(pathname, response.clone());

  const assetUrls = new Set();
  const attributePattern = /(?:src|href)=["']([^"']+)["']/g;
  let match;
  while ((match = attributePattern.exec(html)) !== null) {
    try {
      const assetUrl = new URL(match[1], self.location.origin);
      if (assetUrl.origin === self.location.origin && isStaticAsset(assetUrl)) {
        assetUrls.add(assetUrl.href);
      }
    } catch {
      // Ignore malformed asset references in an otherwise valid document.
    }
  }

  const staticCache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(Array.from(assetUrls, async (assetUrl) => {
    const assetRequest = new Request(assetUrl, { cache: 'reload', credentials: 'same-origin' });
    await cacheResponse(staticCache, assetRequest, await fetch(assetRequest));
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const staticCache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(CORE_ASSETS.map(async (pathname) => {
      const request = new Request(pathname, { cache: 'reload', credentials: 'same-origin' });
      const response = await fetch(request);
      await cacheResponse(staticCache, request, response);
    }));
    await Promise.allSettled(SHELL_ROUTES.map(precacheNormalShell));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE && name !== STATIC_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === SERVICE_WORKER_VERSION_REQUEST) {
    event.ports[0]?.postMessage({ version: SERVICE_WORKER_VERSION });
    return;
  }

  if (event.data?.type !== SERVICE_WORKER_ARM_LITE_REQUEST) return;

  event.waitUntil((async () => {
    try {
      const cache = await caches.open(SHELL_CACHE);
      // The acknowledgement is intentionally sent only after the persistent
      // marker exists. Until then the login page must not navigate.
      await markLiteState(cache);
      event.ports[0]?.postMessage({
        type: SERVICE_WORKER_ARM_LITE_ACK,
        armed: true,
        version: SERVICE_WORKER_VERSION,
      });
    } catch {
      liteFailClosed = true;
      event.ports[0]?.postMessage({
        type: SERVICE_WORKER_ARM_LITE_ACK,
        armed: false,
        version: SERVICE_WORKER_VERSION,
      });
    }
  })());
});

async function staticAssetResponse(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  return cacheResponse(cache, request, await fetch(request));
}

async function navigationResponse(request) {
  const cache = await caches.open(SHELL_CACHE);
  const url = new URL(request.url);
  const cached = await cache.match(url.pathname);
  const wasLite = await hasLiteState(cache);

  if (self.navigator.onLine === false) {
    if (wasLite) return liteOfflineResponse();
    if (cached) return cached;
  }

  let response;
  try {
    response = await fetch(request);
  } catch {
    if (wasLite) return liteOfflineResponse();
    const moduleFallback = url.pathname.startsWith('/app/ava') ? '/app/ava' : '/app';
    return cached
      || await cache.match(moduleFallback)
      || await cache.match('/login')
      || await cache.match('/')
      || Response.error();
  }

  try {
    const classification = await classifyNavigationResponse(cache, url.pathname, response);
    if (wasLite && classification === null) return liteOfflineResponse();
  } catch {
    if (wasLite) return liteOfflineResponse();
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staticAssetResponse(request));
  }
});
