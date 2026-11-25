import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app, auth, db, firebaseConfig, isFirebaseConfigured } from '../config/firebase';
import {
  requestNotificationPermission,
  triggerDeviceNotification,
} from '../lib/deviceNotifications';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
let foregroundListenerAttached = false;

function hashTokenId(token) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `tok_${(hash >>> 0).toString(16)}`;
}

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios-pwa';
  if (/Android/i.test(ua)) return 'android-web';
  if (/Windows/i.test(ua)) return 'windows-desktop';
  if (/Mac/i.test(ua)) return 'macos-desktop';
  return 'web';
}

async function registerMessagingServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  const qs = new URLSearchParams({
    apiKey: firebaseConfig.apiKey || '',
    projectId: firebaseConfig.projectId || '',
    messagingSenderId: firebaseConfig.messagingSenderId || '',
    appId: firebaseConfig.appId || '',
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${qs.toString()}`, {
    scope: '/firebase-cloud-messaging-push-scope',
  });
}

export const pushService = {
  /**
   * Returns true if VAPID key is present for true background FCM Web Push.
   */
  isFcmConfigured() {
    return Boolean(isFirebaseConfigured && VAPID_KEY && VAPID_KEY.trim().length > 10);
  },

  /**
   * Requests OS notification permission (must be triggered by a user click/tap on mobile/Safari)
   * and, if FCM VAPID key is configured, registers & saves the device push token in Firestore.
   */
  async enablePushNotifications(userId) {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      return { permission, fcmRegistered: false };
    }

    const fcmRegistered = await this.syncPushToken(userId);
    return { permission, fcmRegistered };
  },

  /**
   * Silently syncs the device FCM push token if permission is already granted & VAPID key is set.
   */
  async syncPushToken(userId) {
    if (!userId || !db || !app || !this.isFcmConfigured()) return false;
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;

    try {
      const supported = await isSupported();
      if (!supported) return false;

      const swReg = await registerMessagingServiceWorker();
      const messaging = getMessaging(app);

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY.trim(),
        serviceWorkerRegistration: swReg || undefined,
      });

      if (!token) return false;

      const tokenId = hashTokenId(token);
      await setDoc(
        doc(db, 'users', userId, 'pushTokens', tokenId),
        {
          token,
          platform: detectPlatform(),
          userAgent: (navigator.userAgent || '').slice(0, 400),
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (!foregroundListenerAttached) {
        foregroundListenerAttached = true;
        onMessage(messaging, (payload) => {
          const title = payload?.notification?.title || payload?.data?.title || 'SmileGuard AI';
          const body = payload?.notification?.body || payload?.data?.body || '';
          const url = payload?.fcmOptions?.link || payload?.data?.url || '/';
          if (body) {
            triggerDeviceNotification(title, body, {
              url,
              tag: payload?.data?.tag || `fcm-${Date.now()}`,
            });
          }
        });
      }

      return true;
    } catch (err) {
      console.warn('[PushService] FCM token sync skipped:', err?.message || err);
      return false;
    }
  },

  /**
   * Sends a non-blocking background Web Push request to /api/push so closed browsers & locked phones
   * receive an OS notification via Firebase Cloud Messaging.
   */
  async dispatchPushToUsers(userIds, { title, body, url = '/', type = 'GENERAL', priority = 'NORMAL', tag = '' }) {
    const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)));
    if (uniqueIds.length === 0 || !title || !body) return { ok: false, skipped: true };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (auth?.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          if (idToken) headers.Authorization = `Bearer ${idToken}`;
        } catch {
          // Proceed without token if unavailable
        }
      }

      const response = await fetch('/api/push', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userIds: uniqueIds,
          title,
          body,
          url,
          type,
          priority,
          tag: tag || `sg-${Date.now()}`,
        }),
      });

      return await response.json().catch(() => ({ ok: response.ok }));
    } catch (err) {
      // Non-blocking: real-time Firestore listener still delivers alerts to open tabs
      console.warn('[PushService] Background push dispatch skipped:', err?.message || err);
      return { ok: false, error: err?.message };
    }
  },
};
