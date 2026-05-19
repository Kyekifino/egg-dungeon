const CACHE = 'egg-dungeon-v1';

const ASSETS = [
  '.',
  'index.html',
  'style.css',
  'game.js',
  'manifest.json',
  'modules/utils.js',
  'modules/world.js',
  'modules/creature.js',
  'modules/state.js',
  'modules/audio.js',
  'modules/render.js',
  'modules/input.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
