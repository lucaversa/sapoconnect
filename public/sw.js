/* global self, caches, fetch, URL, Request, Response */

const SHELL_CACHE = 'sapoconnect-shell-v3';
const STATIC_CACHE = 'sapoconnect-static-v3';
const CACHE_PREFIX = 'sapoconnect-';
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

async function cacheDocumentAndAssets(pathname) {
  const cache = await caches.open(SHELL_CACHE);
  const request = new Request(pathname, { cache: 'reload', credentials: 'same-origin' });
  const response = await fetch(request);
  if (!response.ok) return;

  await cache.put(pathname, response.clone());
  if (!response.headers.get('content-type')?.includes('text/html')) return;

  const html = await response.text();
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

  if (self.navigator.onLine === false && cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(url.pathname, response.clone());
    return response;
  } catch {
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
