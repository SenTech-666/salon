// sw.js — Service Worker для PWA (оффлайн + кэш), всё в корне сайта
const CACHE_NAME = 'vasiliki-pwa-v6';  // ← новая версия, чтоб старый кэш сдох

const urlsToCache = [
  '/',                        // корень
  '/index.html',
  '/calendar.html',
  '/styles.css',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/sw.js',                   // сам себя кэшируем

  // Все JS-модули из src/ (если они в корне или в /src/)
  '/src/main.js',
  '/src/store.js',
  '/src/components.js',
  '/src/modal.js',
  '/src/toast.js',
  '/src/telegram.js',
  '/src/telegram-client.js',
  '/src/firebase.js',
  '/src/calendar.js'
];

self.addEventListener('install', event => {
  console.log('SW: Установка начата, господин...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Кэшируем все нужные файлы');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('SW: Активация, старые кэши нахуй');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys => {
        return Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) return caches.delete(key);
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => {
        console.log('SW: Оффлайн, файл не найден:', event.request.url);
      })
  );
});