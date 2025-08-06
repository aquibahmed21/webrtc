const CACHE_NAME = "kitecite";
const urlsToCache = [
  "/",
  "/index.html",
  "/webrtc/manifest.json",
  "/webrtc/src/app.js",
  "/webrtc/src/media.js",
  "/webrtc/src/recording.js",
  "/webrtc/src/room.js",
  "/webrtc/src/signalling.js",
  "/webrtc/src/style.css",
  "/webrtc/src/channel.css",
  "/webrtc/images/kitecite.svg",
  "/webrtc/images/icon-192.png",
  "/webrtc/images/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.all(
          urlsToCache.map(url => {
            return fetch(url)
              .then(response => {
                if (!response.ok) {
                  throw new Error('Failed to fetch ' + url);
                }
                return cache.put(url, response);
              });
          })
        );
      })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('push', event => {
  const json = event.data.json ? event.data.json() : event.data.text();
  const options = {
    title: event.data.json ? json.title : 'New Message',
    body: event.data.json ? json.body : event.data.text(),
    icon: '/images/icon-192.png',
    badge: '/images/icon-192.png'
  };

  event.waitUntil(
    self.registration.showNotification('New Message', options)
  );
});