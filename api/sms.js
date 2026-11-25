/**
 * SmileGuard AI — Serverless SMS Dispatch Endpoint (/api/sms)
 * Keeps SEMAPHORE_API_KEY strictly server-side (never bundled into client JS)
 * and avoids browser CORS errors when calling the Semaphore PH SMS API.
 */

const SEMAPHORE_API_URL = 'https://api.semaphore.co/api/v4/messages';

function normalizePhMobile(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+639') && cleaned.length === 13) return `09${cleaned.slice(4)}`;
  if (cleaned.startsWith('639') && cleaned.length === 12) return `09${cleaned.slice(3)}`;
  if (cleaned.startsWith('09') && cleaned.length === 11) return cleaned;
  if (cleaned.startsWith('9') && cleaned.length === 10) return `0${cleaned}`;
  return null;
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
  const normalizedPhone = normalizePhMobile(body.to);
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!normalizedPhone) {
    return res.status(400).json({
      ok: false,
      status: 'FAILED',
      error: 'Invalid Philippine mobile number format.',
    });
  }

  if (!message || message.length > 640) {
    return res.status(400).json({
      ok: false,
      status: 'FAILED',
      error: 'SMS message must be between 1 and 640 characters.',
    });
  }

  const apiKey = (process.env.SEMAPHORE_API_KEY || process.env.SMS_API_KEY || '').trim();
  const senderName = (process.env.SEMAPHORE_SENDER_NAME || 'SMILEGUARD').trim();

  if (!apiKey || apiKey.length < 6) {
    return res.status(200).json({
      ok: true,
      status: 'SIMULATED',
      recipientPhone: normalizedPhone,
      providerResponse: {
        mock: true,
        provider: 'Semaphore (Server Simulation — set SEMAPHORE_API_KEY to enable live SMS)',
        simulatedRecipient: normalizedPhone,
        simulatedAt: new Date().toISOString(),
      },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(SEMAPHORE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: apiKey,
        number: normalizedPhone,
        message,
        sendername: senderName,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    clearTimeout(timeout);

    if (response.ok && Array.isArray(data) && data[0]?.status) {
      return res.status(200).json({
        ok: true,
        status: 'SENT',
        recipientPhone: normalizedPhone,
        providerResponse: data,
      });
    }

    const errMsg =
      data?.error || (Array.isArray(data) && data[0]?.message) || 'Semaphore SMS gateway error';
    return res.status(502).json({
      ok: false,
      status: 'FAILED',
      recipientPhone: normalizedPhone,
      error: errMsg,
      providerResponse: data,
    });
  } catch (err) {
    clearTimeout(timeout);
    return res.status(502).json({
      ok: false,
      status: 'FAILED',
      recipientPhone: normalizedPhone,
      error: err?.name === 'AbortError' ? 'SMS gateway request timed out' : err?.message || 'SMS network error',
    });
  }
}
