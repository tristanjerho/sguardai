import { collection, addDoc, getDocs, query, where, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { isCloudinaryConfigured, getCloudinaryUploadUrl, cloudinaryConfig } from '../config/cloudinary';
import { activityLogService } from './activityLogService';

/**
 * Service for dental images & radiographs
 * Cloudinary stores the image files; Cloud Firestore stores image clinical metadata.
 */
export const imageService = {
  /**
   * Uploads an image directly to Cloudinary and saves its clinical metadata in Firestore
   * @param {File|Blob} file - Radiograph or dental image file
   * @param {Object} metadata
   * @param {string} metadata.patientId
   * @param {string} metadata.type - 'BITEWING' | 'PERIAPICAL' | 'PANORAMIC' | 'INTRAORAL' | 'EXTRAORAL'
   * @param {Array<string>} [metadata.toothNumbers] - e.g. ['16', '17']
   * @param {string} metadata.uploadedBy - UID of dentist/staff or patient
   * @param {string} [metadata.notes]
   * @returns {Promise<Object>} Created dentalImage document
   */
  async uploadDentalImage(file, { patientId, type = 'INTRAORAL', toothNumbers = [], uploadedBy, notes = '' }) {
    if (!isCloudinaryConfigured()) {
      throw new Error(
        'Cloudinary is not configured. Please set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env file.'
      );
    }

    if (!db) {
      throw new Error('Firestore is not initialized.');
    }

    const uploadUrl = getCloudinaryUploadUrl();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('folder', `smileguard/patients/${patientId}/${type.toLowerCase()}`);
    formData.append('context', `patientId=${patientId}|type=${type}`);

    // Direct client upload to Cloudinary
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to upload image to Cloudinary.');
    }

    // Save clinical metadata in Cloud Firestore
    const imageDocData = {
      patientId,
      uploadedBy: uploadedBy || 'system',
      cloudinaryPublicId: data.public_id,
      secureUrl: data.secure_url,
      resourceType: data.resource_type,
      format: data.format,
      width: data.width,
      height: data.height,
      bytes: data.bytes,
      type: type.toUpperCase(),
      toothNumbers: toothNumbers || [],
      notes: notes.trim(),
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'dentalImages'), imageDocData);

    await activityLogService.log({
      userId: uploadedBy,
      action: 'IMAGE_UPLOADED',
      resourceType: 'DENTAL_IMAGE',
      resourceId: docRef.id,
      entity: `${type} image attached to patient record`,
    });

    return {
      id: docRef.id,
      ...imageDocData,
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Retrieves dental images for a specific patient from Firestore
   * @param {string} patientId
   * @param {string} [filterType]
   * @returns {Promise<Array<Object>>}
   */
  async getPatientImages(patientId, filterType = null) {
    if (!db || !patientId) return [];

    try {
      let q = query(collection(db, 'dentalImages'), where('patientId', '==', patientId));
      const snapshot = await getDocs(q);
      const images = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!filterType || data.type === filterType.toUpperCase()) {
          images.push({
            id: docSnap.id,
            ...data,
            imageUrl: data.secureUrl, // For backward compatibility with UI components
            title: `${data.type} Scan ${data.toothNumbers?.length ? `(Tooth ${data.toothNumbers.join(', ')})` : ''}`,
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : (data.createdAt || new Date().toISOString()),
          });
        }
      });

      return images.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (err) {
      console.error('Error fetching patient images from Firestore:', err);
      throw err;
    }
  },

  /**
   * Removes dental image record from Firestore
   * @param {string} imageId
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async deleteDentalImage(imageId, userId) {
    if (!db || !imageId) return;
    await deleteDoc(doc(db, 'dentalImages', imageId));

    await activityLogService.log({
      userId,
      action: 'IMAGE_DELETED',
      resourceType: 'DENTAL_IMAGE',
      resourceId: imageId,
      entity: 'Removed dental image metadata record',
    });
  },
};
