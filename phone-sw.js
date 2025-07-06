self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'INCOMING_CALL') {
    const { from } = event.data;
    self.registration.showNotification('Incoming Call', {
      body: `Call from ${from}`,
      icon: '/static/img/vintage-phone.png', // Optional: add your icon path
      tag: 'sip-incoming-call',
      vibrate: [200, 100, 200],
      data: { url: '/' },
      actions: [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' }
      ]
    });
  } else if (event.data && event.data.type === 'CALL_ENDED') {
    const { from } = event.data;
    self.registration.showNotification('Call Ended', {
      body: `Call with ${from} has ended.`,
      icon: '/static/img/vintage-phone.png', // Optional: add your icon path
      tag: 'sip-call-ended',
      vibrate: [200, 100, 200],
      data: { url: '/' }
    });
  } else {
    console.log('Received message in service worker:', event.data);
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'answer' || event.action === 'decline') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        // Send a message to the first open client (tab)
        if (windowClients.length > 0) {
          windowClients[0].postMessage({
            type: 'CALL_ACTION',
            action: event.action,
            from: event.notification.data.from
          });
          return windowClients[0].focus();
        } else {
          // If no window is open, open one
          return clients.openWindow('/');
        }
      })
    );
  } else {
    // Default click: just focus or open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        if (windowClients.length > 0) {
          return windowClients[0].focus();
        } else {
          return clients.openWindow('/');
        }
      })
    );
  }
});

self.addEventListener('notificationclose', event => {
  console.log('Notification closed:', event.notification);
  // send decline action
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      if (windowClients.length > 0) {
        windowClients[0].postMessage({
          type: 'CALL_ACTION',
          action: 'decline',
          from: event.notification.data.from
        });
        return windowClients[0].focus();
      } else {
        return clients.openWindow('/');
      }
    })
  );
});

self.addEventListener('push', event => {
  console.log('Push notification received:', event);
});
