import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { activityLogService } from './activityLogService';

// All 32 permanent teeth (FDI notation)
// Upper Right: 18, 17, 16, 15, 14, 13, 12, 11
// Upper Left:  21, 22, 23, 24, 25, 26, 27, 28
// Lower Left:  38, 37, 36, 35, 34, 33, 32, 31
// Lower Right: 41, 42, 43, 44, 45, 46, 47, 48
export const ALL_TEETH = [
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41,
  31, 32, 33, 34, 35, 36, 37, 38,
];

export const TOOTH_CONDITIONS = {
  HEALTHY: { label: 'Healthy / Sound', color: 'emerald' },
  CARIES: { label: 'Caries (Decay)', color: 'rose' },
  COMPOSITE: { label: 'Composite Filling', color: 'blue' },
  AMALGAM: { label: 'Amalgam Filling', color: 'slate' },
  CROWN: { label: 'Crown / Cap', color: 'amber' },
  ROOT_CANAL: { label: 'Root Canal Treated', color: 'purple' },
  MISSING: { label: 'Missing / Extracted', color: 'gray' },
  IMPLANT: { label: 'Dental Implant', color: 'teal' },
};

/**
 * Service for real 32-tooth odontogram chart persistence in Cloud Firestore
 */
export const odontogramService = {
  /**
   * Retrieves the 32-tooth odontogram chart for a patient from Firestore
   * @param {string} patientId
   * @returns {Promise<Object>} Map of toothNumber -> tooth details
   */
  async getOdontogram(patientId) {
    if (!db || !patientId) return this.getDefaultTeethMap();

    try {
      const docRef = doc(db, 'odontograms', patientId);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        return this.getDefaultTeethMap();
      }

      const data = snapshot.data();
      const storedTeeth = data.teeth || {};

      // Merge stored teeth with default 32 teeth
      const fullMap = {};
      ALL_TEETH.forEach((tNum) => {
        fullMap[tNum] = storedTeeth[tNum] || {
          toothNumber: tNum,
          condition: 'HEALTHY',
          surfaces: [],
          treatmentStatus: 'NONE',
          diagnosis: '',
          notes: '',
        };
      });

      return fullMap;
    } catch (err) {
      console.error('Error fetching odontogram from Firestore:', err);
      throw err;
    }
  },

  /**
   * Updates a specific tooth's clinical condition and surfaces in Firestore
   * @param {string} patientId
   * @param {number|string} toothNumber
   * @param {Object} toothData
   * @param {string} [dentistId]
   * @returns {Promise<Object>}
   */
  async updateTooth(patientId, toothNumber, toothData, dentistId = 'system') {
    if (!db || !patientId) throw new Error('Firestore is not initialized.');

    const docRef = doc(db, 'odontograms', patientId);
    const updatePayload = {
      patientId,
      [`teeth.${toothNumber}`]: {
        toothNumber: Number(toothNumber),
        condition: toothData.condition || 'HEALTHY',
        surfaces: toothData.surfaces || [],
        treatmentStatus: toothData.treatmentStatus || 'NONE',
        diagnosis: toothData.diagnosis || '',
        notes: toothData.notes || '',
        updatedAt: new Date().toISOString(),
      },
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, updatePayload, { merge: true });

    await activityLogService.log({
      userId: dentistId,
      action: 'ODONTOGRAM_UPDATED',
      resourceType: 'ODONTOGRAM',
      resourceId: patientId,
      entity: `Updated tooth #${toothNumber} (${toothData.condition}) for patient ${patientId}`,
    });

    return updatePayload[`teeth.${toothNumber}`];
  },

  /**
   * Generates default healthy teeth map
   */
  getDefaultTeethMap() {
    const map = {};
    ALL_TEETH.forEach((tNum) => {
      map[tNum] = {
        toothNumber: tNum,
        condition: 'HEALTHY',
        surfaces: [],
        treatmentStatus: 'NONE',
        diagnosis: '',
        notes: '',
      };
    });
    return map;
  },
};
