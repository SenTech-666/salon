// sw.js — Service Worker для PWA (оффлайн + кэш), всё в корне сайта
const CACHE_NAME = 'vasiliki-pwa-v7';  // ← новая версия, чтоб старый кэш сдох

const urlsToCache = [
  '/',                          // корень
  '/index.html',                // главная
  '/calendar.html',             // календарь
  '/styles.css',                // стили
  '/manifest.json',             // манифест
  '/assets/icon-192.png',       // иконка 192
  '/assets/icon-512.png',       // иконка 512
  '/sw.js',                     // сам себя

  // JS-модули из src/
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
  console.log('SW: Установка, господин...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Кэшируем файлы');
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
      .then(response => {
        if (response) return response;  // Из кэша
        return fetch(event.request).then(networkResponse => {
          // Кэшируем новые файлы
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
      .catch(() => {
        console.log('SW: Оффлайн, файл:', event.request.url);
        // Фоллбэк — можно добавить оффлайн-страницу
        return new Response('Оффлайн, попробуйте позже, господин.', { status: 503 });
      })
  );
});