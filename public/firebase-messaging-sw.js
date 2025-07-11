// This is the service worker for Firebase Cloud Messaging, managed by next-pwa.
// next-pwa will inject Firebase App and Firebase Messaging libraries,
// and initialize Firebase app with your config from firebaseConfig.ts.

// This is the placeholder for the Workbox manifest.
// The next-pwa plugin will replace this with a list of all your app's files.
self.__WB_MANIFEST;

// Handle background messages here, if any.
// You might need to access `firebase.messaging()` here after next-pwa initializes it.
// The firebase global object should be available.

// Example: Show a notification for background messages
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const title = data.notification.title || 'New Message';
    const options = {
      body: data.notification.body,
      icon: data.notification.icon || '/karobhr.png', // Use your app icon
      data: data.data,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/'; // Handle deep linking
  event.waitUntil(clients.openWindow(url));
});
