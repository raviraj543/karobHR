import * as admin from 'firebase-admin';
import { initializeApp, getApps, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore'; // Corrected import from 'firebase-admin/firestore'

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
  
  const rawServiceAccount = JSON.parse(decodedServiceAccount);

  // Map snake_case properties from raw JSON to camelCase for ServiceAccount
  const serviceAccount: ServiceAccount = {
    projectId: rawServiceAccount.project_id,
    clientEmail: rawServiceAccount.client_email,
    privateKey: rawServiceAccount.private_key, 
  };

  // This is crucial for Firebase Admin SDK to correctly parse the private key
  // by converting literal '\\n' (backslash followed by n) to actual newline characters.
  if (serviceAccount.privateKey) {
    serviceAccount.privateKey = serviceAccount.privateKey.replace(/\\n/g, '\n');
  }

  initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  
  console.log("Firebase Admin: App initialized successfully.");
}

const authAdmin = getAuth();
const firestoreAdmin = getFirestore();

export { authAdmin, firestoreAdmin };
