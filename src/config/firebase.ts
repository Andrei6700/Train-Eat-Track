// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Auth,
  getAuth,
  initializeAuth,
} from "firebase/auth";
// @ts-expect-error -- getReactNativePersistence is exported at runtime by firebase/auth but missing from the TS typings in v12
import { getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missingConfigFields = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfigFields.length > 0) {
  throw new Error(
    `Missing Firebase environment variables: ${missingConfigFields.join(", ")}`,
  );
}

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig as Record<string, string>);

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;

export const firestore = getFirestore(app);
