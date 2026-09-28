/**
 * Device notification & haptic feedback helper.
 * Provides on-screen pop-up notifications and phone vibrations for real-time booking alerts.
 */

export function triggerDeviceNotification(title, message, options = {}) {
  // Mobile haptic vibration feedback
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(options.vibrate || [150, 75, 150]);
    } catch {
      // Ignore vibration error if not allowed by browser
    }
  }

  // Native Browser / Phone Web Notification
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: options.tag || 'smileguard-booking-alert',
          ...options,
        });
      } catch (err) {
        console.warn('Native notification trigger:', err);
      }
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          try {
            new Notification(title, {
              body: message,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              ...options,
            });
          } catch (err) {
            console.warn('Native notification permission trigger:', err);
          }
        }
      });
    }
  }
}

/**
 * Prompt user for notification permission if not already prompted.
 */
export function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}
