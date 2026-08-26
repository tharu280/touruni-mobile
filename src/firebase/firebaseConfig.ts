// Firebase configuration — IoT integration
// All values come from EXPO_PUBLIC_* environment variables.
// Do NOT hardcode any Firebase credentials here.
//
// Required .env additions:
//   EXPO_PUBLIC_FIREBASE_API_KEY=
//   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
//   EXPO_PUBLIC_FIREBASE_DATABASE_URL=
//   EXPO_PUBLIC_FIREBASE_PROJECT_ID=
//   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
//   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
//   EXPO_PUBLIC_FIREBASE_APP_ID=

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId
);

// IoT/Firebase is an optional feature (see iot-device-implementation-plan.md).
// Skip init when unconfigured so a missing Firebase project doesn't crash the
// whole app for every screen that has nothing to do with IoT.
let firebaseApp: FirebaseApp | null = null;
let rtdbInstance: Database | null = null;
let firebaseAuthInstance: Auth | null = null;

if (firebaseConfigured) {
  firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  rtdbInstance = getDatabase(firebaseApp);
  firebaseAuthInstance = getAuth(firebaseApp);
} else {
  console.warn(
    'Firebase is not configured (EXPO_PUBLIC_FIREBASE_* env vars missing). ' +
      'IoT live-data features will be unavailable.'
  );
}

export const rtdb = rtdbInstance;
export const firebaseAuth = firebaseAuthInstance;
export default firebaseApp;
