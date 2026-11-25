/**
 * SmileGuard AI — Firebase Cloud Messaging Background Service Worker
 * Handles OS push notifications on computers & mobile phones even when the browser tab is closed,
 * and routes notification clicks directly to the relevant Clinic or Laboratory page.
 */

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

(function initSmileGuardMessagingSW() {
  try {
    const params = new URL(self.location.href).searchParams;
    const apiKey = params.get('apiKey');
    const projectId = params.get('projectId');
    const messagingSenderId = params.get('messagingSenderId');
    const appId = params.get('appId');

    if (apiKey && projectId && messagingSenderId && appId) {
      if (!firebase.apps.length) {
        firebase.initializeApp({
          apiKey,
          projectId,
          messagingSenderId,
          appId,
        });
      }

      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const title =
          payload?.notification?.title ||
          payload?.data?.title ||
          'SmileGuard AI Alert';
        const body =
          payload?.notification?.body ||
          payload?.data?.body ||
          'You have a new clinical or laboratory notification.';
        const url = payload?.fcmOptions?.link || payload?.data?.url || '/';
        const tag = payload?.data?.tag || `smileguard-push-${Date.now()}`;

        self.registration.showNotification(title, {
          body,
          icon: '/logo-icon.png',
          badge: '/notification-badge.png',
          tag,
          renotify: true,
          vibrate: [200, 100, 200],
          data: { url },
        });
      });
    }
  } catch (err) {
    console.warn('[SmileGuard SW] Background messaging init warning:', err);
  }
})();

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            return client.navigate(targetUrl).catch(() => {});
          }
          return client;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
