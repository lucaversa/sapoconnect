/* global self, caches, fetch, URL, Request, Response */

const SHELL_CACHE = 'sapoconnect-shell-v4';
const STATIC_CACHE = 'sapoconnect-static-v4';
const CACHE_PREFIX = 'sapoconnect-';
const OWN3D_DOCUMENT_KEY = '/__sapoconnect-own3d-document';
const OWN3D_STATE_KEY = '/__sapoconnect-own3d-state';
const OWN3D_MARKER = 'data-own3d-screen';
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

async function cacheNavigationResponse(cache, pathname, response) {
  if (!response.ok || response.type === 'opaque') return null;

  const isHtml = response.headers.get('content-type')?.includes('text/html');
  if (!isHtml) return null;

  const html = await response.clone().text();
  const isOwn3dDocument = html.includes(OWN3D_MARKER);

  if (isOwn3dDocument) {
    // Keep the restricted document separate from route caches so it can never
    // leak into another account that later uses the same browser profile.
    await cache.put(OWN3D_DOCUMENT_KEY, response.clone());
    await cache.put(OWN3D_STATE_KEY, new Response('active'));
    await cache.delete(pathname);
    return true;
  }

  // Store a normal document before clearing the restricted-state marker. This
  // ordering keeps an interrupted account switch fail-closed.
  await cache.put(pathname, response.clone());
  await cache.delete(OWN3D_STATE_KEY);
  return false;
}

async function getActiveOwn3dDocument(cache) {
  const state = await cache.match(OWN3D_STATE_KEY);
  if (!state) return null;
  return await cache.match(OWN3D_DOCUMENT_KEY) || Response.error();
}

async function cacheDocumentAndAssets(pathname) {
  const cache = await caches.open(SHELL_CACHE);
  const request = new Request(pathname, { cache: 'reload', credentials: 'same-origin' });
  const response = await fetch(request);
  if (!response.ok) return;

  await cacheNavigationResponse(cache, pathname, response);
  if (!response.headers.get('content-type')?.includes('text/html')) return;

  const html = await response.clone().text();
  const assetUrls = new Set();
  const attributePattern = /(?:src|href)=["']([^"']+)["']/g;
  let match;
  while ((match = attributePattern.exec(html)) !== null) {
    try {
      const url = new URL(match[1], self.location.origin);
      if (url.origin === self.location.origin && isStaticAsset(url)) {
        assetUrls.add(url.href);
      }
    } catch {
      // Ignore malformed or unsupported asset URLs.
    }
  }

  const staticCache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(Array.from(assetUrls, async (url) => {
    const assetRequest = new Request(url, { cache: 'reload', credentials: 'same-origin' });
    const assetResponse = await fetch(assetRequest);
    await cacheResponse(staticCache, assetRequest, assetResponse);
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
    await Promise.allSettled(SHELL_ROUTES.map(cacheDocumentAndAssets));
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
  const activeOwn3dDocument = await getActiveOwn3dDocument(cache);

  if (self.navigator.onLine === false) {
    if (activeOwn3dDocument) return activeOwn3dDocument;
    if (cached) return cached;
  }

  try {
    const response = await fetch(request);
    const classification = await cacheNavigationResponse(cache, url.pathname, response);
    if (activeOwn3dDocument && classification === null) return activeOwn3dDocument;
    return response;
  } catch {
    if (activeOwn3dDocument) return activeOwn3dDocument;
    const moduleFallback = url.pathname.startsWith('/app/ava') ? '/app/ava' : '/app';
    return cached
      || await cache.match(moduleFallback)
      || await cache.match('/login')
      || await cache.match('/')
      || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staticAssetResponse(request));
  }
});
