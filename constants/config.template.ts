// Application configuration constants

// Cloudinary configuration for image uploads
// TODO: Replace with your actual Cloudinary configuration
export const CLOUDINARY_CONFIG = {
  cloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "your-cloud-name",
  uploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "your-upload-preset",
};

// API endpoints
export const API_CONFIG = {
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.example.com",
};

// App configuration
export const APP_CONFIG = {
  name: "Train Eat Track",
  version: "1.0.0",
};
