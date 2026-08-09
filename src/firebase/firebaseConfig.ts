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

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Prevent duplicate initialization (hot reload safe)
const firebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const rtdb = getDatabase(firebaseApp);
export const firebaseAuth = getAuth(firebaseApp);
export default firebaseApp;
