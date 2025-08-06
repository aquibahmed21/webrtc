self.addEventListener("install", (event) => {
  

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