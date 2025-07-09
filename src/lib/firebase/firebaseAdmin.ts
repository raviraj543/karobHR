import * as admin from 'firebase-admin';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  console.log("Firebase Admin: Initializing...");
  console.log("Firebase Admin - Env Check: ");
  console.log("  PROJECT_ID (Raw):", process.env.FIREBASE_PROJECT_ID);
  console.log("  CLIENT_EMAIL (Raw):", process.env.FIREBASE_CLIENT_EMAIL);
  console.log("  PRIVATE_KEY length (Raw):", process.env.FIREBASE_PRIVATE_KEY?.length);
  console.log("  PRIVATE_KEY (First 50 chars, Raw):", process.env.FIREBASE_PRIVATE_KEY?.substring(0, 50));

  initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
    }),
  });
  console.log("Firebase Admin: App initialized.");
}

const authAdmin = getAuth();
const firestoreAdmin = getFirestore();

export { authAdmin, firestoreAdmin };
// Forced re-build trigger: Fri Jul 12 2024 18:05:00 GMT+0000 (Coordinated Universal Time) - Added more detailed logging for env vars.