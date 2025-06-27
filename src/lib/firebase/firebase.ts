
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from './config';

let firebaseAppInstance: any; // Firebase App instance
let authInstance: any; // Firebase Auth instance
let dbInstance: Firestore; // Firestore instance
let storageInstance: FirebaseStorage; // Firebase Storage instance

function initializeFirebaseServices() {
  const isConfigured = getApps().length > 0;
  const currentApp = isConfigured ? getApp() : initializeApp(firebaseConfig);
  
  if (!isConfigured) {
    firebaseAppInstance = currentApp;
    authInstance = getAuth(firebaseAppInstance);
    dbInstance = getFirestore(firebaseAppInstance);
    storageInstance = getStorage(firebaseAppInstance);

    if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
      if (!authInstance.emulatorConfig) {
        console.log("Connecting to Firebase Auth Emulator");
        connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
      }
      // Check if firestore emulator is already connected to avoid multiple connections
      // This is a common pattern for Next.js development with emulators in strict mode
      if (!(dbInstance as any)._settings.host || !(dbInstance as any)._settings.host.startsWith('127.0.0.1')) {
         console.log("Connecting to Firebase Firestore Emulator");
         connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
      }
      // connectStorageEmulator(storage, '127.0.0.1', 9199);
    }
  }

  return { firebaseApp: currentApp, auth: authInstance, db: dbInstance, storage: storageInstance, isConfigured };
}

// Initialize services on module load (for server-side execution)
// For client-side, getFirebaseInstances will ensure singleton
// Ensure initialization runs when this module is imported,
// crucial for server components and static generation.
initializeFirebaseServices();

export { dbInstance as db, authInstance as auth, storageInstance as storage }; // Export db directly

export function getFirebaseInstances() {
  if (!firebaseAppInstance) {
    initializeFirebaseServices();
  }
  return { firebaseApp: firebaseAppInstance, auth: authInstance, db: dbInstance, storage: storageInstance, isConfigured: getApps().length > 0 };
}
