// sw.js
const CACHE_NAME = 'vasiliki-pwa-v8';  // ← повышаем версию, чтобы старый кэш ушёл

// Относительные пути — без ведущего слеша
const urlsToCache = [
  './',
  './index.html',
  './calendar.html',
  './styles.css',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './sw.js',

  // JS-модули (тоже относительные)
  './src/main.js',
  './src/store.js',
  './src/components.js',
  './src/modal.js',
  './src/toast.js',
  './src/telegram.js',
  './src/telegram-client.js',
  './src/firebase.js',
  './src/calendar.js'
];

self.addEventListener('install', event => {
  console.log('SW: Установка...');
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
  console.log('SW: Активация, чистим старое');
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
        if (response) return response;
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
      .catch(() => {
        return new Response('Оффлайн-режим. Попробуйте позже.', { status: 503 });
      })
  );
});