/**
 * Environment configuration validation
 * Validates that required environment variables and configuration are present
 */

import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "@/constants/config";

export type ConfigValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Validates Cloudinary configuration
 */
export const validateCloudinaryConfig = (): ConfigValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!CLOUDINARY_CLOUD_NAME || typeof CLOUDINARY_CLOUD_NAME !== 'string') {
    errors.push('CLOUDINARY_CLOUD_NAME is not configured');
  } else if (CLOUDINARY_CLOUD_NAME.trim().length === 0) {
    errors.push('CLOUDINARY_CLOUD_NAME is empty');
  }

  if (!CLOUDINARY_UPLOAD_PRESET || typeof CLOUDINARY_UPLOAD_PRESET !== 'string') {
    errors.push('CLOUDINARY_UPLOAD_PRESET is not configured');
  } else if (CLOUDINARY_UPLOAD_PRESET.trim().length === 0) {
    errors.push('CLOUDINARY_UPLOAD_PRESET is empty');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validates Firebase configuration
 */
export const validateFirebaseConfig = async (): Promise<ConfigValidationResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const { auth, firestore } = await import("@/src/config/firebase");

    if (!auth) {
      errors.push('Firebase Auth is not initialized');
    }

    if (!firestore) {
      errors.push('Firebase Firestore is not initialized');
    }
  } catch (error) {
    errors.push('Firebase configuration file is missing or invalid');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validates all application configuration
 */
export const validateAppConfig = async (): Promise<ConfigValidationResult> => {
  const cloudinaryResult = validateCloudinaryConfig();
  const firebaseResult = await validateFirebaseConfig();

  return {
    isValid: cloudinaryResult.isValid && firebaseResult.isValid,
    errors: [...cloudinaryResult.errors, ...firebaseResult.errors],
    warnings: [...cloudinaryResult.warnings, ...firebaseResult.warnings],
  };
};

/**
 * Logs validation results
 */
export const logConfigValidation = (result: ConfigValidationResult): void => {
  if (result.isValid) {
    console.log('[Config] Configuration validation passed ✓');
  } else {
    console.error('[Config] Configuration validation failed:');
    result.errors.forEach(error => console.error(`  - ${error}`));
  }

  if (result.warnings.length > 0) {
    console.warn('[Config] Configuration warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
};
