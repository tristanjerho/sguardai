/**
 * Device notification, sound chime, Service Worker PWA alerts, & haptic feedback helper.
 * Works across Desktop browsers (Windows/macOS), Android Chrome, and iOS Home-Screen PWAs.
 */

const SOUND_PREF_KEY = 'smileguard_notif_sound_enabled';

/**
 * Returns the browser Notification API permission state.
 * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
 */
export function getNotificationPermissionStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Reads user sound preference (enabled by default).
 * @returns {boolean}
 */
export function isNotificationSoundEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    const val = window.localStorage.getItem(SOUND_PREF_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Persists user sound preference.
 * @param {boolean} enabled
 */
export function setNotificationSoundEnabled(enabled) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Plays a gentle 2-note clinical chime using the Web Audio API (no external mp3 asset required).
 * Silently no-ops if browser autoplay policy hasn't been unlocked yet.
 */
export function playNotificationChime(urgent = false) {
  if (typeof window === 'undefined' || !isNotificationSoundEnabled()) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = urgent ? [880, 1174.66, 1318.51] : [659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.24);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 900);
  } catch {
    // Ignore Web Audio errors when autoplay is blocked
  }
}

/**
 * Dispatches an OS-level notification (computer & phone), haptic vibration, and optional chime.
 * Uses ServiceWorkerRegistration.showNotification() first (required on Android/iOS PWAs),
 * falling back to window.Notification on desktop browsers without an active SW.
 *
 * @param {string} title
 * @param {string} message
 * @param {Object} [options]
 * @param {string} [options.tag] - Unique tag to prevent overwriting unrelated alerts
 * @param {string} [options.url] - In-app route to open when the notification is clicked
 * @param {number[]} [options.vibrate] - Mobile vibration pattern
 * @param {boolean} [options.urgent] - Plays 3-tone urgent chime and requests interaction
 * @param {boolean} [options.silent] - Suppresses sound chime
 */
export async function triggerDeviceNotification(title, message, options = {}) {
  if (typeof window === 'undefined') return false;

  // 1. Subtle alert chime
  if (!options.silent) {
    playNotificationChime(Boolean(options.urgent));
  }

  // 2. Mobile haptic vibration feedback
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(options.vibrate || (options.urgent ? [220, 90, 220, 90, 220] : [160, 80, 160]));
    } catch {
      // Ignore vibration error if blocked
    }
  }

  // 3. Native Computer / Phone OS Notification
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  const uniqueTag =
    options.tag || `smileguard-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const targetUrl = options.url || '/';

  const notifOptions = {
    body: message,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: uniqueTag,
    renotify: true,
    requireInteraction: Boolean(options.urgent),
    vibrate: options.vibrate || [160, 80, 160],
    data: { url: targetUrl },
  };

  // Prefer Service Worker showNotification (required on Android Chrome & iOS PWAs)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, notifOptions);
        return true;
      }
    } catch (swErr) {
      console.warn('ServiceWorker showNotification fallback:', swErr);
    }
  }

  // Desktop fallback via Notification constructor
  try {
    const notif = new Notification(title, {
      body: message,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: uniqueTag,
      requireInteraction: Boolean(options.urgent),
    });
    notif.onclick = () => {
      try {
        window.focus();
        if (targetUrl && window.location.pathname !== targetUrl) {
          window.location.assign(targetUrl);
        }
        notif.close();
      } catch {
        // Ignore navigation errors
      }
    };
    return true;
  } catch (err) {
    console.warn('Native notification trigger:', err);
    return false;
  }
}

/**
 * Prompt user for notification permission (best called from a user click/tap gesture).
 * @returns {Promise<'granted' | 'denied' | 'default' | 'unsupported'>}
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission !== 'default') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission || 'denied';
  }
}
