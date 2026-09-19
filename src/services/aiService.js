import { delay } from './mock/storage';

/**
 * Mock AI Diagnostic Inference Service
 * (Simulates Deep Learning Panoramic Radiograph Classification & Grad-CAM Heatmap Generation)
 */
export const aiService = {
  /**
   * Runs mock AI analysis on a radiograph image
   * @param {string} imageSource
   * @returns {Promise<Object>}
   */
  async analyzeRadiograph(imageSource) {
    await delay(1200); // Realistic AI inference latency

    return {
      id: `ai-diag-${Date.now()}`,
      modelName: 'SmileGuard DentalDenseNet-v3.2',
      disclaimer: 'AI suggestion only. Final diagnosis is made by the dentist.',
      isDemoData: true,
      findings: [
        {
          condition: 'Impacted Mandibular Third Molar (#38)',
          confidence: 94.2,
          level: 'HIGH',
          description: 'Mesioangular impaction contacting distal root of #37.',
          recommendation: 'Surgical extraction evaluation recommended.',
        },
        {
          condition: 'Interproximal Caries (#16 Distal)',
          confidence: 76.5,
          level: 'MODERATE',
          description: 'Radiolucency extending into middle third of dentin.',
          recommendation: 'Bitewing verification & class II composite restoration.',
        },
        {
          condition: 'Periapical Radiolucency (#24 Apex)',
          confidence: 48.1,
          level: 'LOW',
          description: 'Inconclusive widening of periodontal ligament space.',
          recommendation: 'Vitality testing required. Low model confidence.',
        },
      ],
      overallRisk: 'MODERATE',
      gradCamHeatmapUrl: imageSource, // Heatmap will be composited via CSS gradient/canvas
    };
  },
};
