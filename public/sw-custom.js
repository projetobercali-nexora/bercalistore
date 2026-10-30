/* Service Worker complementar da Bercali Store:
 * - Nunca faz cache a pedidos Supabase (REST, RPC, Auth, Realtime, Storage) nem a links WhatsApp (wa.me).
 * - Faz cache apenas à estrutura da aplicação (HTML/App Shell + página offline.html).
 * - Limpa caches antigos ao ativar e só assume controlo quando o utilizador aceita atualizar.
 */

const OFFLINE_CACHE_NAME = 'bercali-offline-v2';
const ALLOWED_BERCALI_CACHES = new Set([
  OFFLINE_CACHE_NAME,
  'bercali-static-brand-assets',
  'bercali-google-fonts-stylesheets',
  'bercali-google-fonts-webfonts',
]);

function isBypassedRealtimeOrExternalRequest(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  // Nunca interferir com redirecionamentos WhatsApp nem eventos de marketing
  if (
    host === 'wa.me' ||
    host.endsWith('.wa.me') ||
    host === 'whatsapp.com' ||
    host.endsWith('.whatsapp.com') ||
    host === 'connect.facebook.net' ||
    host.endsWith('.facebook.com')
  ) {
    return true;
  }

  // Nunca fazer cache ao Supabase (produtos, preços, stock, configurações, RPC, storage)
  if (
    host.endsWith('.supabase.co') ||
    host.endsWith('.supabase.in') ||
    path.includes('/rest/v1/') ||
    path.includes('/rpc/') ||
    path.includes('/storage/v1/') ||
    path.includes('/auth/v1/') ||
    path.includes('/realtime/v1/')
  ) {
    return true;
  }

  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE_NAME)
      .then((cache) => cache.add(new Request('/offline.html', { cache: 'reload' })))
      .catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key.startsWith('bercali-') && !ALLOWED_BERCALI_CACHES.has(key)) {
            return caches.delete(key);
          }
          return Promise.resolve(false);
        })
      )
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (isBypassedRealtimeOrExternalRequest(url)) {
    return;
  }

  // Navegação HTML da própria loja: tenta sempre a rede primeiro; sem internet mostra offline.html
  if (
    request.mode === 'navigate' &&
    url.origin === self.location.origin &&
    url.pathname !== '/sw.js' &&
    url.pathname !== '/sw-custom.js' &&
    url.pathname !== '/manifest.webmanifest'
  ) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const offlinePage =
            (await caches.match('/offline.html', { ignoreSearch: true })) ||
            (await caches.open(OFFLINE_CACHE_NAME).then((c) => c.match('/offline.html')));
          if (offlinePage) {
            return offlinePage;
          }
          return new Response(
            '<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem ligação à internet</title></head><body style="background:#0A0A0A;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center"><div><h1>Sem ligação à internet</h1><p style="color:#8A8A8A;margin-top:8px">Verifica a tua ligação e tenta novamente.</p></div></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        }
      })()
    );
  }
});
