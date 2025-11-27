// sw.js — Service Worker для PWA (оффлайн + кэш), для поддиректории /calendar/
const CACHE_NAME = 'nails-app-v4';  // Увеличь версию, чтобы сбросить старый кэш
const urlsToCache = [
  '/calendar/',  // Корень поддиректории
  '/calendar/index.html',
  '/calendar/calendar.html',
  '/calendar/styles.css',
  '/calendar/manifest.json',
  '/calendar/icon-192.png',
  '/calendar/icon-512.png',
  '/calendar/sw.js',  // Сам себя кэширует
  // Твои JS-модули (добавь все, что есть в src/)
  '/calendar/src/main.js',
  '/calendar/src/store.js',
  '/calendar/src/components.js',
  '/calendar/src/modal.js',
  '/calendar/src/toast.js',
  '/calendar/src/telegram.js',
  '/calendar/src/telegram-client.js',
  '/calendar/src/firebase.js',
  '/calendar/src/calendar.js'  // Если есть
];

self.addEventListener('install', event => {
  console.log('SW: Installing...');  // Для дебага в консоли
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('SW: Activating...');
  event.waitUntil(self.clients.claim());
  // Удаляем старые кэши
  caches.keys().then(cacheNames => {
    return Promise.all(
      cacheNames.map(cacheName => {
        if (cacheName !== CACHE_NAME) {
          return caches.delete(cacheName);
        }
      })
    );
  });
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;  // Из кэша
        return fetch(event.request).catch(() => {
          console.log('SW: Offline fallback for', event.request.url);
        });
      })
  );
});