import { auth } from '../config/firebase';

const PRIMARY_CHAT_URL = '/api/chat';
const RENDER_CHAT_URL = 'https://sguardai.onrender.com/api/chat';
const LOCAL_PYTHON_CHAT_URL = 'http://127.0.0.1:8000/api/chat';

const STORAGE_KEY_PREFIX = 'smileguard_assistant_history_';

export const DEFAULT_SUGGESTED_PROMPTS = [
  'How do I manage patient appointments?',
  'What does the AI dental X-ray diagnosis mean?',
  'How do I communicate with a dental laboratory?',
  'How do I register a new patient?',
  'What features are available in SmileGuard AI?'
];

export const EMERGENCY_PATTERNS = [
  /\b(severe swelling|facial swelling|swollen face|face swollen|eye swollen)\b/i,
  /\b(difficulty breathing|trouble breathing|hard to breathe|can't breathe)\b/i,
  /\b(difficulty swallowing|trouble swallowing|can't swallow)\b/i,
  /\b(uncontrolled bleeding|heavy bleeding|bleeding won't stop|hemorrhage)\b/i,
  /\b(knocked out tooth|avulsed tooth|tooth knocked out|broken jaw|severe trauma)\b/i
];

export function isEmergencyQuery(text) {
  if (!text) return false;
  return EMERGENCY_PATTERNS.some((rx) => rx.test(text));
}

export function getRouteSuggestedPrompts(pathname = '', role = 'GUEST') {
  if (pathname.includes('/ai-workstation')) {
    return [
      'What does the AI dental X-ray diagnosis mean?',
      'How does the two-stage CNN validator work?',
      'What is pre-softmax Grad-CAM explainability?',
      'Why was an image rejected as Non-OPG?'
    ];
  }
  if (pathname.includes('/queue')) {
    return [
      'How do I manage patient appointments in the queue?',
      'How does double-booking prevention work?',
      'When should a patient be moved to IN_CHAIR?',
      'How do I decline an appointment with a clinical reason?'
    ];
  }
  if (pathname.includes('/patients')) {
    return [
      'How do I use the 32-tooth interactive odontogram?',
      'How do I register a new patient?',
      'How does medical onboarding comply with RA 10173?',
      'How do I record findings on tooth surfaces?'
    ];
  }
  if (pathname.includes('/lab-orders') || pathname.includes('/lab')) {
    return [
      'How do I communicate with a dental laboratory?',
      'What are the 6 CAD/CAM production stages?',
      'What dental appliances are supported for orders?',
      'How do technicians advance fabrication stages?'
    ];
  }
  if (pathname.includes('/admin')) {
    return [
      'How do I provision new dentist accounts?',
      'How do I inspect clinic security and activity logs?',
      'What user roles are supported in SmileGuard AI?',
      'What features are available in SmileGuard AI?'
    ];
  }
  if (pathname.includes('/book') || pathname.includes('/patient')) {
    return [
      'How do I book an appointment?',
      'How do daily brushing streaks work?',
      'Where can I see my orthodontic treatment progress?',
      'What do I do if I have a toothache?'
    ];
  }
  return DEFAULT_SUGGESTED_PROMPTS;
}

export function generateSoapNote(summaryText = '', userRole = 'DENTIST') {
  const timestamp = new Date().toLocaleString();
  const cleanSnippet = summaryText
    .replace(/[#*`>]/g, '')
    .split('\n')
    .filter(Boolean)
    .slice(0, 4)
    .join(' ');

  return `--- SMILEGUARD DENTAL CLINICAL DECISION SUPPORT NOTE ---
Date/Time: ${timestamp}
Author Role: ${userRole || 'Dental Clinician'}

[S] SUBJECTIVE:
- Clinical decision support query initiated regarding: ${cleanSnippet || 'Dental diagnostic / workflow inquiry'}.

[O] OBJECTIVE:
- Dental panoramic radiograph (OPG) and clinic chart findings reviewed in SmileGuard AI.
- Two-Stage CNN validation and multi-class pathology classification referenced.

[A] ASSESSMENT (Decision Support Only):
- Radiographic feature review completed. Non-definitive AI inference.
- Differential diagnostic considerations: Correlate with clinical symptoms, pulp vitality, and percussion testing.

[P] PLAN:
- Comprehensive chairside visual and tactile intraoral examination.
- Periapical / bitewing radiograph confirmation if active caries or apical lesion suspected.
- Formulate personalized treatment plan with patient statutory consent (RA 10173).

⚠️ CLINICAL DISCLAIMER:
AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.
------------------------------------------------------`;
}

export const INITIAL_WELCOME_MESSAGE = {
  id: 'welcome-0',
  role: 'assistant',
  content:
    "Hello! I'm Gardy Assistant. I can help you navigate SmileGuard AI, understand dental information, and assist with your clinic workflows. How can I help you today?",
  timestamp: Date.now()
};

/**
 * Gardy Assistant Chat Service
 * Handles conversational queries, authentication tokens, rate limits,
 * multiple endpoint auto-failover, and conversation persistence.
 */
export const chatService = {
  /**
   * Retrieves conversation history for the specified user or guest
   * @param {string} [userId='guest']
   * @returns {Array<Object>}
   */
  loadHistory(userId = 'guest') {
    try {
      const key = `${STORAGE_KEY_PREFIX}${userId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not load chat history:', e);
    }
    return [INITIAL_WELCOME_MESSAGE];
  },

  /**
   * Persists message history locally, capped at the last 30 messages
   * @param {string} [userId='guest']
   * @param {Array<Object>} messages
   */
  saveHistory(userId = 'guest', messages = []) {
    try {
      const key = `${STORAGE_KEY_PREFIX}${userId}`;
      // Never store excessive volume or sensitive raw patient documents
      const trimmed = messages.slice(-30).map((m) => ({
        id: m.id || `msg-${m.timestamp}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp || Date.now(),
        disclaimer: m.disclaimer || null,
        suggestedFollowUps: m.suggestedFollowUps || []
      }));
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Could not save chat history:', e);
    }
  },

  /**
   * Clears saved conversation history
   * @param {string} [userId='guest']
   */
  clearHistory(userId = 'guest') {
    try {
      const key = `${STORAGE_KEY_PREFIX}${userId}`;
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Could not clear chat history:', e);
    }
  },

  /**
   * Sends conversational messages to the secure AI backend with auto-failover
   * @param {Array<Object>} messages - Chronological message array
   * @param {Object} [options]
   * @param {string} [options.role='GUEST'] - Authenticated user role
   * @param {Object} [options.context] - Page route, sanitized context
   * @returns {Promise<Object>}
   */
  async sendMessage(messages, options = {}) {
    if (!messages || !messages.length) {
      throw new Error('Message content is required.');
    }

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };

    // Attach verified Firebase ID Token if user is logged in
    const currentUser = auth?.currentUser;
    if (currentUser) {
      try {
        const idToken = await currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${idToken}`;
      } catch (e) {
        console.warn('Could not retrieve auth token for chat:', e);
      }
    }

    const payload = {
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      role: options.role || 'GUEST',
      context: options.context || {}
    };

    // Endpoints in order: Local Vite dev server / Vercel API, then Render, then local Python
    const endpointsToTry = [
      PRIMARY_CHAT_URL,
      RENDER_CHAT_URL,
      LOCAL_PYTHON_CHAT_URL
    ];

    let lastError = null;

    for (const endpoint of endpointsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 16000); // 16s timeout

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before sending another message.');
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg =
            errData.detail?.message ||
            errData.message ||
            errData.error ||
            `HTTP ${response.status}`;
          throw new Error(errMsg);
        }

        const data = await response.json();
        return data;
      } catch (err) {
        lastError = err;
        // If it's a rate limit error, don't keep trying fallbacks, fail immediately
        if (err.message?.includes('Rate limit exceeded')) {
          throw err;
        }
        console.warn(`Chat endpoint ${endpoint} failed:`, err.message);
      }
    }

    throw new Error(
      lastError?.message?.includes('aborted')
        ? 'The request timed out. Please try again.'
        : lastError?.message || 'Failed to connect to Gardy Assistant backend.'
    );
  }
};
