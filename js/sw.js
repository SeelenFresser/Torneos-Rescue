// =============================================
// SERVICE WORKER — Rescue TCG Torneos
// Cache estático + fallback offline
// =============================================

const CACHE_NAME = 'rescue-tcg-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/supabase.js',
  '/js/dashboard.js',
  '/js/tournament.js',
  '/js/commander.js',
  '/js/swiss.js',
  '/js/elimination.js',
  '/js/league.js',
  '/js/game-app.js',
  '/js/rooms.js',
  '/js/realtime.js',
  '/js/announce.js',
  '/js/profile.js',
  '/js/timer.js',
  '/js/notifications.js',
  '/img/logo.png',
  '/img/mad-bunny.png',
];

// Instalar — cachear assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW: Some assets failed to cache', err);
      });
    })
  );
  self.skipWaiting();
});

// Activar — limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback a cache
self.addEventListener('fetch', (event) => {
  // No interceptar requests de API ni Supabase
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('vercel.app') && url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/api/')
  ) {
    return; // Dejar pasar sin cache
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Guardar en cache si es exitoso
        if (response.ok && event.request.method === 'GET') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => {
        // Sin red — usar cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Fallback para navegación
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Rescue TCG', {
      body: data.body || '',
      icon: '/img/logo.png',
      badge: '/img/logo.png',
      tag: 'rescue-tcg',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('https://torneos-rescue.vercel.app')
  );
});
