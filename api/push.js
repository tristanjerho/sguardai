/**
 * SmileGuard AI — Serverless Background Push Endpoint (/api/push)
 * Sends true background OS notifications (closed browser / locked phone) via
 * Firebase Cloud Messaging HTTP v1 API using a Google Service Account JWT
 * (implemented with Node built-in `crypto` — zero external npm dependencies).
 *
 * Configure one of the following in Vercel / server environment variables:
 *   - FIREBASE_SERVICE_ACCOUNT_JSON (full service account JSON string)
 *   OR
 *   - FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 */

import crypto from 'node:crypto';

let cachedAccessToken = null;
let cachedTokenExpiry = 0;

function getServiceAccount() {
  const rawJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
        };
      }
    } catch {
      return null;
    }
  }

  const projectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    ''
  ).trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGoogleAccessToken(sa) {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedTokenExpiry - 60 > nowSec) {
    return cachedAccessToken;
  }

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: sa.clientEmail,
      scope:
        'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );

  const unsignedJwt = `${header}.${claimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  const signature = signer
    .sign(sa.privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsignedJwt}.${signature}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResp.json().catch(() => ({}));
  if (!tokenResp.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || 'Failed to mint Google OAuth2 access token');
  }

  cachedAccessToken = tokenData.access_token;
  cachedTokenExpiry = nowSec + Number(tokenData.expires_in || 3600);
  return cachedAccessToken;
}

async function fetchUserPushTokens(projectId, accessToken, userId) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/users/${encodeURIComponent(userId)}/pushTokens`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) return [];
  const data = await resp.json().catch(() => ({}));
  const docs = Array.isArray(data.documents) ? data.documents : [];
  return docs
    .map((d) => d?.fields?.token?.stringValue)
    .filter((tok) => typeof tok === 'string' && tok.length > 10);
}

async function sendFcmMessage(projectId, accessToken, token, payload) {
  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/messages:send`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          title: payload.title,
          body: payload.body,
          url: payload.url || '/',
          type: payload.type || 'GENERAL',
          tag: payload.tag || `sg-${Date.now()}`,
        },
        webpush: {
          headers: {
            Urgency: payload.priority === 'HIGH' ? 'high' : 'normal',
          },
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/logo-icon.png',
            badge: '/notification-badge.png',
            tag: payload.tag || `sg-${Date.now()}`,
            renotify: true,
          },
          fcm_options: {
            link: payload.url || '/',
          },
        },
      },
    }),
  });

  return resp.ok;
}

export default async function handler(req, res) {
  const origin = req.headers?.origin || '';
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body || {};
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((id) => typeof id === 'string' && id.trim()).slice(0, 25)
    : [];
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 140) : '';
  const msgBody = typeof body.body === 'string' ? body.body.trim().slice(0, 400) : '';
  const url = typeof body.url === 'string' && body.url.startsWith('/') ? body.url : '/';
  const type = typeof body.type === 'string' ? body.type.slice(0, 40) : 'GENERAL';
  const priority = body.priority === 'HIGH' ? 'HIGH' : 'NORMAL';
  const tag = typeof body.tag === 'string' ? body.tag.slice(0, 80) : `sg-${Date.now()}`;

  if (userIds.length === 0 || !title || !msgBody) {
    return res.status(400).json({ ok: false, error: 'userIds, title, and body are required.' });
  }

  const sa = getServiceAccount();
  if (!sa) {
    return res.status(200).json({
      ok: true,
      mode: 'client-realtime-only',
      sent: 0,
      message: 'Background FCM push not configured (set FIREBASE_SERVICE_ACCOUNT_JSON to enable).',
    });
  }

  try {
    const accessToken = await getGoogleAccessToken(sa);
    const tokenGroups = await Promise.all(
      userIds.map((uid) => fetchUserPushTokens(sa.projectId, accessToken, uid))
    );
    const allTokens = Array.from(new Set(tokenGroups.flat()));

    if (allTokens.length === 0) {
      return res.status(200).json({ ok: true, mode: 'fcm-v1', sent: 0, tokensFound: 0 });
    }

    const results = await Promise.all(
      allTokens.map((tok) =>
        sendFcmMessage(sa.projectId, accessToken, tok, {
          title,
          body: msgBody,
          url,
          type,
          priority,
          tag,
        })
      )
    );

    const sent = results.filter(Boolean).length;
    return res.status(200).json({
      ok: true,
      mode: 'fcm-v1',
      sent,
      tokensFound: allTokens.length,
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err?.message || 'Failed to dispatch FCM push notification',
    });
  }
}
