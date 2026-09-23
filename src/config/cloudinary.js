/**
 * Cloudinary Configuration for SmileGuard
 * Handles client-side direct uploads using unsigned upload presets
 * and responsive/diagnostic image transformations.
 */

export const cloudinaryConfig = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '',
};

export const isCloudinaryConfigured = () => {
  return Boolean(cloudinaryConfig.cloudName && cloudinaryConfig.uploadPreset);
};

export const getCloudinaryUploadUrl = () => {
  if (!cloudinaryConfig.cloudName) {
    throw new Error('Cloudinary cloud name is not configured.');
  }
  return `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
};

/**
 * Builds an optimized Cloudinary transformation URL for dental images / radiographs.
 * @param {string} url - Original secure Cloudinary URL
 * @param {Object} options
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @param {boolean} [options.enhanceContrast] - Increases contrast for radiograph lucency inspection
 * @param {boolean} [options.thumbnail]
 * @returns {string}
 */
export const getOptimizedImageUrl = (url, options = {}) => {
  if (!url || !url.includes('res.cloudinary.com')) return url;

  const { width, height, enhanceContrast, thumbnail } = options;
  const transformations = ['f_auto', 'q_auto'];

  if (thumbnail) {
    transformations.push('c_thumb', 'g_auto');
  } else if (width || height) {
    transformations.push('c_limit');
  }

  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (enhanceContrast) transformations.push('e_contrast:40');

  const transformString = transformations.join(',');
  return url.replace('/image/upload/', `/image/upload/${transformString}/`);
};
