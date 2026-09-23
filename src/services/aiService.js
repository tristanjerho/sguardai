import { auth } from '../config/firebase';

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || '';

/**
 * Service for AI Diagnostic Workstation & Gemini/CNN radiograph inference.
 * Strictly adheres to Zero Fabrication Policy:
 * Results are only produced when a real, authorized server-side AI endpoint responds.
 */
export const aiService = {
  /**
   * Checks if a server-side AI inference endpoint is configured
   * @returns {boolean}
   */
  isAiConfigured() {
    return Boolean(AI_SERVICE_URL);
  },

  /**
   * Sends a radiograph for clinical AI inference to the server-side boundary
   * @param {string} imageUrl - Authorized Cloudinary or storage radiograph URL
   * @param {Object} [options]
   * @param {string} [options.patientId]
   * @param {string} [options.radiographType]
   * @returns {Promise<Object>} Authentic model inference results
   */
  async analyzeRadiograph(imageUrl, options = {}) {
    if (!this.isAiConfigured()) {
      throw new Error(
        'AI Diagnostic service is unconfigured. A trusted backend endpoint (VITE_AI_SERVICE_URL) holding your Gemini/CNN model credentials is required.'
      );
    }

    if (!imageUrl) {
      throw new Error('Image URL is required for diagnostic analysis.');
    }

    const currentUser = auth?.currentUser;
    if (!currentUser) {
      throw new Error('Authentication required to invoke clinical AI inference.');
    }

    const idToken = await currentUser.getIdToken();

    const response = await fetch(AI_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        imageUrl,
        patientId: options.patientId,
        radiographType: options.radiographType,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `AI service responded with HTTP status ${response.status}`);
    }

    const result = await response.json();
    return result;
  },
};
