const CACHE_NAME = 'voice-loop-v2';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './tts-utils.js',
    './config.js',
    './manifest.json',
    './ic_launcher.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
