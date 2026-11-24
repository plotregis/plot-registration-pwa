'use strict';
const CACHE_NAME = 'plotreg-shell-v23';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './config.js', './api-client.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('plotreg-shell-') && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // Never intercept API form submissions, Google Drive, Google identity, or cross-origin requests.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Keep the Apps Script /exec endpoint setting fresh after a deployment URL change.
  if (url.pathname.endsWith('/config.js')) {
    event.respondWith(fetch(req).then(response => {
      if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, response.clone()));
      return response;
    }).catch(() => caches.match(req)));
    return;
  }
  if (url.pathname.endsWith('/config.js')) {
    event.respondWith(fetch(req).then(res => { if (res.ok) caches.open(CACHE_NAME).then(c => c.put(req, res.clone())); return res; }).catch(() => caches.match(req)));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => { if (res.ok) caches.open(CACHE_NAME).then(c => c.put('./index.html', res.clone())); return res; }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) caches.open(CACHE_NAME).then(c => c.put(req, res.clone())); return res; })));
});
