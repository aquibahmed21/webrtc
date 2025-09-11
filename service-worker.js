// Service Worker Installation
self.addEventListener("install", (event) => {
  console.log('Service Worker installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Service Worker Activation
self.addEventListener("activate", (event) => {
  console.log('Service Worker activating...');
  // Take control of all clients immediately
  event.waitUntil(self.clients.claim());
});

// Fetch event handler for caching
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Otherwise fetch from network
        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache the response
          caches.open('webrtc-cache-v1').then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        // Return offline page if available
        return caches.match('/offline.html');
      })
  );
});

self.addEventListener('push', event => {
  let notificationData = {
    title: 'KiteCite Conference',
    body: 'You have a new message or call',
    icon: '/images/icon-192.png',
    badge: '/images/icon-192.png',
    tag: 'webrtc-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  // Handle different data formats
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || notificationData.tag,
        data: data.data || {}
      };
    } catch (e) {
      // If JSON parsing fails, try text
      const text = event.data.text();
      if (text) {
        notificationData.body = text;
      }
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Handle notification click events
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  // Handle different notification actions
  if (event.action === 'close') {
    return; // Just close the notification
  }

  // Default action or 'open' action
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function (clientList) {
      // Check if there's already a window/tab open with our app
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // Check if the client is for our app (matches our origin)
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Focus the existing window and navigate to the app
          return client.focus().then(() => {
            // Send a message to the client to handle the notification
            if (client.postMessage) {
              client.postMessage({
                type: 'NOTIFICATION_CLICK',
                data: event.notification.data || {}
              });
            }
          });
        }
      }

      // If no existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow('/').then(function (newClient) {
          // Send message to the new client when it's ready
          if (newClient && newClient.postMessage) {
            newClient.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: event.notification.data || {}
            });
          }
        });
      }
    }).catch(function (error) {
      console.error('Error handling notification click:', error);
    })
  );
});