// Custom Service Worker for PhantomLock Push Notifications
// This extends the VitePWA service worker with push notification support

// Handle push notifications when app is in background
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  if (!event.data) {
    console.log('[SW] Push event has no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'PhantomLock',
      body: event.data.text(),
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    };
  }

  const options = {
    body: data.body || data.message || 'Neue Benachrichtigung',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || 'phantomlock-notification',
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'PhantomLock', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window if not open
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotes());
  } else if (event.tag === 'sync-photos') {
    event.waitUntil(syncPhotos());
  } else if (event.tag === 'sync-files') {
    event.waitUntil(syncFiles());
  }
});

// Background sync handlers
async function syncNotes() {
  console.log('[SW] Syncing notes...');
  // This will be handled by the main app when it comes online
}

async function syncPhotos() {
  console.log('[SW] Syncing photos...');
}

async function syncFiles() {
  console.log('[SW] Syncing files...');
}

// Periodic background sync for reminders
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkReminders());
  }
});

async function checkReminders() {
  // Fetch reminders from IndexedDB and show notifications
  // This runs even when the app is closed
  try {
    const cache = await caches.open('reminder-cache');
    const response = await cache.match('pending-reminders');
    
    if (response) {
      const reminders = await response.json();
      const now = Date.now();
      
      for (const reminder of reminders) {
        if (new Date(reminder.remind_at).getTime() <= now && !reminder.notified) {
          await self.registration.showNotification(reminder.title || 'Erinnerung', {
            body: reminder.note_title || 'Du hast eine Erinnerung',
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: `reminder-${reminder.id}`,
            data: { url: `/notes/${reminder.note_id}` },
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 200],
          });
        }
      }
    }
  } catch (error) {
    console.error('[SW] Error checking reminders:', error);
  }
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SCHEDULE_NOTIFICATION') {
    scheduleNotification(event.data.payload);
  } else if (event.data.type === 'CACHE_REMINDERS') {
    cacheReminders(event.data.payload);
  } else if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function scheduleNotification(payload) {
  const { title, body, delay, tag, url } = payload;
  
  // Use setTimeout for delayed notifications
  // Note: This only works while SW is active
  setTimeout(() => {
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: tag || 'scheduled-notification',
      data: { url: url || '/dashboard' },
      requireInteraction: true,
    });
  }, delay);
}

async function cacheReminders(reminders) {
  try {
    const cache = await caches.open('reminder-cache');
    await cache.put(
      'pending-reminders',
      new Response(JSON.stringify(reminders))
    );
    console.log('[SW] Cached', reminders.length, 'reminders');
  } catch (error) {
    console.error('[SW] Error caching reminders:', error);
  }
}

console.log('[SW] Custom Service Worker loaded');
