
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { firebaseConfig } from './config'; // Import only the config object

// Declare variables that will hold our Firebase instances
let firebaseApp: any;
let auth: any;
let db: Firestore;
let storage: any;

// Initialize Firebase App (runs once when the module is imported)
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

// Initialize Firebase Services immediately and assign to the declared variables.
// This ensures they are always assigned and available upon module load.
auth = getAuth(firebaseApp);
db = getFirestore(firebaseApp);
storage = getStorage(firebaseApp);

// Connect to emulators only in development environment
if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
  // Check if emulators are already connected to avoid re-initialization warnings
  if (auth && !auth.emulatorConfig) { // Ensure auth is defined before checking emulatorConfig
    console.log("Connecting to Firebase Auth Emulator");
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  if (db && (!(db as any)._settings.host || !(db as any)._settings.host.startsWith('127.0.0.1'))) { // Ensure db is defined
     console.log("Connecting to Firebase Firestore Emulator");
     connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  // Optional: connectStorageEmulator(storage, '127.0.0.1', 9199);
}

// Export the initialized instances directly
export { firebaseApp, auth, db, storage };

// Removed getFirebaseInstances function as it's no longer necessary with direct exports
// and could lead to re-initialization issues.
