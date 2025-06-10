
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from "firebase/storage";
import { firebaseConfig } from './config';

function initializeFirebaseServices() {
  const isConfigured = getApps().length > 0;
  const firebaseApp = isConfigured ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);

  // Only use emulators in a development environment
  const useEmulators = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

  if (useEmulators) {
    // Check if emulators are already running to avoid re-initialization
    // This is a common issue in React's strict mode.
    if (!auth.emulatorConfig) {
      console.log("Connecting to Firebase Auth Emulator");
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    // A type assertion is used here because the property to check emulator connection is not publicly typed.
    if (!(db as any)._settings.host.startsWith('127.0.0.1')) {
       console.log("Connecting to Firebase Firestore Emulator");
       connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    // Note for Storage Emulator: If you use the storage emulator, you might need
    // to add its connection logic here as well, similar to Auth and Firestore.
    // e.g., connectStorageEmulator(storage, '127.0.0.1', 9199);
  }

  return { firebaseApp, auth, db, storage, isConfigured };
}

let firebaseServices: ReturnType<typeof initializeFirebaseServices> | null = null;

export function getFirebaseInstances() {
  // On the client-side, we want to create a single instance of Firebase services.
  if (typeof window !== "undefined") {
    if (!firebaseServices) {
      firebaseServices = initializeFirebaseServices();
    }
    return firebaseServices;
  }
  
  // On the server-side (e.g., for SSR or API routes), we want to re-initialize
  // to avoid sharing instances between different server requests.
  return initializeFirebaseServices();
}
