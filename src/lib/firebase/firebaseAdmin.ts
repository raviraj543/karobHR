import * as admin from 'firebase-admin';
import { initializeApp, getApps, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  console.log("Firebase Admin: Initializing...");

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set.");
  }

  console.log("Found FIREBASE_SERVICE_ACCOUNT_BASE64. Decoding and using it.");
  const decodedServiceAccount = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
    'base64'
  ).toString('utf8');
  
  const serviceAccount: ServiceAccount = JSON.parse(decodedServiceAccount);

  // Handle private key newlines for Firebase Admin SDK initialization
  if (serviceAccount.privateKey) {
    // Replace literal 
 with actual newline characters
    serviceAccount.privateKey = serviceAccount.privateKey.replace(new RegExp('
', 'g'), '
');
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
