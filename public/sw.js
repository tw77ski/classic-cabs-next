// Service Worker for Classic Cabs
// Basic service worker to prevent 404 errors

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through all requests to network
  event.respondWith(fetch(event.request));
});

