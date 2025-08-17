self.addEventListener("install", (event) => {


});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

self.addEventListener("activate", (event) => {
});

self.addEventListener('push', event => {
  const json = event.data.json ? event.data.json() : event.data.text();
  const options = {
    title: event.data.json ? json.title : 'New Message',
    body: event.data.json ? json.body : event.data.text(),
    icon: event.data.json ? json.icon :  '/images/icon-192.png',
    badge: event.data.json ? json.badge : '/images/icon-192.png'
  };

  event.waitUntil(
    self.registration.showNotification('New Message', options)
  );
});

// on click of notification, open existing window or open new window
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({
      type: 'window'
    }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});