import * as admin from 'firebase-admin';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  console.log("Firebase Admin: Initializing...");
  console.log("Firebase Admin - Env Check (Raw):");
  console.log("  PROJECT_ID:", process.env.FIREBASE_PROJECT_ID);
  console.log("  CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL);
  console.log("  PRIVATE_KEY length:", process.env.FIREBASE_PRIVATE_KEY?.length);
  console.log("  PRIVATE_KEY (First 50 chars):", process.env.FIREBASE_PRIVATE_KEY?.substring(0, 50));

  // Process the private key to handle escaped newlines from CI/CD environments
  const processedPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  console.log("Firebase Admin - Env Check (Processed):");
  console.log("  PRIVATE_KEY length (Processed):", processedPrivateKey?.length);
  console.log("  PRIVATE_KEY (First 50 chars, Processed):", processedPrivateKey?.substring(0, 50));

  initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: processedPrivateKey,
    }),
  });
  console.log("Firebase Admin: App initialized.");
}

const authAdmin = getAuth();
const firestoreAdmin = getFirestore();

export { authAdmin, firestoreAdmin };
// Final attempt re-creation: Re-created firebaseAdmin.ts with robust private key parsing and enhanced logging.