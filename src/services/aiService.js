import { auth } from '../config/firebase';

const PRIMARY_AI_URL = import.meta.env.VITE_AI_SERVICE_URL || 'https://sguardai.onrender.com/api/predict';
const LOCAL_AI_URL = 'http://127.0.0.1:8000/api/predict';

const PRIMARY_INFO_URL = import.meta.env.VITE_AI_MODEL_INFO_URL || 'https://sguardai.onrender.com/api/model-info';
const LOCAL_INFO_URL = 'http://127.0.0.1:8000/api/model-info';

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
    return Boolean(PRIMARY_AI_URL || LOCAL_AI_URL);
  },

  /**
   * Retrieves authentic model architecture, test accuracy, and metadata from backend
   * @returns {Promise<Object>}
   */
  async getModelInfo() {
    const urls = [PRIMARY_INFO_URL, LOCAL_INFO_URL].filter(Boolean);
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (response.ok) return await response.json();
      } catch (err) {
        console.warn(`Could not fetch model info from ${url}:`, err);
      }
    }
    return null;
  },

  /**
   * Sends a radiograph (File or Image URL) for real clinical CNN inference with auto-failover
   * @param {File|Blob|string} imageInput - File object or image URL
   * @param {Object} [options]
   * @param {string} [options.patientId]
   * @param {string} [options.radiographType]
   * @returns {Promise<Object>} Authentic neural network inference results
   */
  async analyzeRadiograph(imageInput, options = {}) {
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

    // Build unique endpoints list to try in order (cloud first, then local fallback)
    const targetEndpoints = Array.from(new Set([PRIMARY_AI_URL, LOCAL_AI_URL].filter(Boolean)));
    let lastError = null;

    for (const endpoint of targetEndpoints) {
      try {
        let response;

        if (imageInput instanceof File || imageInput instanceof Blob) {
          const formData = new FormData();
          formData.append('file', imageInput);
          if (options.patientId) formData.append('patientId', options.patientId);
          if (options.radiographType) formData.append('radiographType', options.radiographType);

          response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: formData,
          });
        } else if (typeof imageInput === 'string') {
          if (imageInput.startsWith('data:image/')) {
            const jsonUrl = endpoint.replace('/api/predict', '/api/predict-json');
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
            const formData = new FormData();
            formData.append('imageUrl', imageInput);
            if (options.patientId) formData.append('patientId', options.patientId);
            if (options.radiographType) formData.append('radiographType', options.radiographType);

            response = await fetch(endpoint, {
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
          throw new Error(detailMsg || errData.message || `AI service error HTTP ${response.status}`);
        }

        const result = await response.json();
        return result;
      } catch (err) {
        lastError = err;
        console.warn(`Inference attempt failed on ${endpoint}:`, err.message);
        // Continue to next endpoint if network failed (Failed to fetch)
      }
    }

    throw new Error(
      lastError?.message?.includes('Failed to fetch')
        ? 'Cannot connect to AI backend. The cloud server may be spinning up from sleep, or the local server is offline.'
        : (lastError?.message || 'AI inference failed.')
    );
  },
};

