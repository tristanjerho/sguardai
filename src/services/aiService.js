import { auth } from '../config/firebase';

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://127.0.0.1:8000/api/predict';
const AI_MODEL_INFO_URL = import.meta.env.VITE_AI_MODEL_INFO_URL || 'http://127.0.0.1:8000/api/model-info';

/**
 * Service for SmileGuard AI Diagnostic Workstation & Real CNN radiograph inference.
 * Strictly adheres to Zero Fabrication Policy:
 * All results (predictions, probabilities, confidence, Grad-CAM) are produced dynamically
 * by the trained EfficientNet neural network.
 */
export const aiService = {
  /**
   * Checks if an AI inference endpoint is configured
   * @returns {boolean}
   */
  isAiConfigured() {
    return Boolean(AI_SERVICE_URL);
  },

  /**
   * Retrieves authentic model architecture, test accuracy, and metadata from backend
   * @returns {Promise<Object>}
   */
  async getModelInfo() {
    try {
      const response = await fetch(AI_MODEL_INFO_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.warn('Could not fetch model info:', err);
      return null;
    }
  },

  /**
   * Sends a radiograph (File or Image URL) for real clinical CNN inference
   * @param {File|Blob|string} imageInput - File object or image URL
   * @param {Object} [options]
   * @param {string} [options.patientId]
   * @param {string} [options.radiographType]
   * @returns {Promise<Object>} Authentic neural network inference results
   */
  async analyzeRadiograph(imageInput, options = {}) {
    if (!this.isAiConfigured()) {
      throw new Error(
        'AI Diagnostic service is unconfigured. A running ML backend endpoint (VITE_AI_SERVICE_URL) is required.'
      );
    }

    if (!imageInput) {
      throw new Error('Dental radiograph image is required for diagnostic analysis.');
    }

    const headers = {};
    const currentUser = auth?.currentUser;
    if (currentUser) {
      try {
        const idToken = await currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${idToken}`;
      } catch (e) {
        console.warn('Could not retrieve auth token:', e);
      }
    }

    let response;

    if (imageInput instanceof File || imageInput instanceof Blob) {
      // Send as Multipart FormData
      const formData = new FormData();
      formData.append('file', imageInput);
      if (options.patientId) formData.append('patientId', options.patientId);
      if (options.radiographType) formData.append('radiographType', options.radiographType);

      response = await fetch(AI_SERVICE_URL, {
        method: 'POST',
        headers,
        body: formData,
      });
    } else if (typeof imageInput === 'string') {
      // Send URL or Base64 payload
      if (imageInput.startsWith('data:image/')) {
        const jsonUrl = AI_SERVICE_URL.replace('/api/predict', '/api/predict-json');
        response = await fetch(jsonUrl, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: imageInput,
            patientId: options.patientId,
            radiographType: options.radiographType || 'OPG',
          }),
        });
      } else {
        // Multipart with imageUrl or JSON
        const formData = new FormData();
        formData.append('imageUrl', imageInput);
        if (options.patientId) formData.append('patientId', options.patientId);
        if (options.radiographType) formData.append('radiographType', options.radiographType);

        response = await fetch(AI_SERVICE_URL, {
          method: 'POST',
          headers,
          body: formData,
        });
      }
    } else {
      throw new Error('Unsupported image input format. Provide a File object or Image URL string.');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const detailMsg = typeof errData.detail === 'object' ? errData.detail?.message : errData.detail;
      throw new Error(detailMsg || errData.message || `AI service responded with HTTP error ${response.status}`);
    }

    const result = await response.json();
    return result;
  },
};
