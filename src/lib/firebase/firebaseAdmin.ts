import * as admin from 'firebase-admin';
import { initializeApp, getApps, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  console.log("Firebase Admin: Initializing...");

  let serviceAccount: ServiceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    console.log("Found FIREBASE_SERVICE_ACCOUNT_BASE64. Decoding and using it.");
    const decodedServiceAccount = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decodedServiceAccount);
  } else {
    // This is a fallback for local development if you're not using the base64 var
    console.log("FIREBASE_SERVICE_ACCOUNT_BASE64 not found. Using individual env vars.");
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/
/g, '
'),
    };
  }
  
  console.log("Firebase Admin - Service Account Check:");
  console.log("  Project ID:", serviceAccount.projectId);
  console.log("  Client Email:", serviceAccount.clientEmail);
  console.log("  Private Key defined:", !!serviceAccount.privateKey);

  initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin: App initialized successfully.");
}

const authAdmin = getAuth();
const firestoreAdmin = getFirestore();

export { authAdmin, firestoreAdmin };
