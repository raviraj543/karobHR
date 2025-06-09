
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { firebaseConfig } from './config';

function initializeFirebaseServices() {
  const isConfigured = getApps().length > 0;
  const firebaseApp = isConfigured ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);

  if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
    // Check if emulators are already running to avoid re-initialization
    // This is a common issue in React's strict mode.
    if (!auth.emulatorConfig) {
      console.log("Connecting to Firebase Auth Emulator");
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    if (!(db as any)._settings.host.startsWith('127.0.0.1')) {
       console.log("Connecting to Firebase Firestore Emulator");
       connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    // Note: Storage emulator connection is handled differently, often by just configuring the SDK.
    // As of recent SDK versions, explicit connection for storage might not be needed if configured correctly elsewhere,
    // but if issues arise, you'd add:
    // import { connectStorageEmulator } from 'firebase/storage';
    // connectStorageEmulator(storage, '127.0.0.1', 9199);
  }

  return { firebaseApp, auth, db, storage, isConfigured };
}

let firebaseServices: ReturnType<typeof initializeFirebaseServices> | null = null;

export function getFirebaseInstances() {
  if (typeof window !== "undefined") {
    if (!firebaseServices) {
      firebaseServices = initializeFirebaseServices();
    }
    return firebaseServices;
  }
  
  // For server-side rendering or non-browser environments,
  // re-initialize to avoid sharing instances across requests.
  return initializeFirebaseServices();
}
