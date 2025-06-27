
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from './config';

let auth: any; // Firebase Auth instance
let db: Firestore; // Firestore instance
let storage: FirebaseStorage; // Firebase Storage instance
let firebaseAppInstance: any; // Firebase App instance

function initializeFirebaseServices() {
  const isConfigured = getApps().length > 0;
  const currentApp = isConfigured ? getApp() : initializeApp(firebaseConfig);
  
  if (!isConfigured) {
    firebaseAppInstance = currentApp;
    auth = getAuth(firebaseAppInstance);
    db = getFirestore(firebaseAppInstance);
    storage = getStorage(firebaseAppInstance);

    if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
      if (!auth.emulatorConfig) {
        console.log("Connecting to Firebase Auth Emulator");
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      }
      // Check if firestore emulator is already connected to avoid multiple connections
      // This is a common pattern for Next.js development with emulators in strict mode
      if (!(db as any)._settings.host || !(db as any)._settings.host.startsWith('127.0.0.1')) {
         console.log("Connecting to Firebase Firestore Emulator");
         connectFirestoreEmulator(db, '127.0.0.1', 8080);
      }
      // connectStorageEmulator(storage, '127.0.0.1', 9199);
    }
  }

  return { firebaseApp: currentApp, auth, db, storage, isConfigured };
}

// Initialize services on module load (for server-side execution)
// For client-side, getFirebaseInstances will ensure singleton
if (typeof window === "undefined" || getApps().length === 0) {
  initializeFirebaseServices();
}

export { db, auth, storage }; // Export db directly

export function getFirebaseInstances() {
  if (!firebaseAppInstance) {
    initializeFirebaseServices();
  }
  return { firebaseApp: firebaseAppInstance, auth, db, storage, isConfigured: getApps().length > 0 };
}
