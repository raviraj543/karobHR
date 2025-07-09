
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage } from "firebase/storage";
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

// Export the initialized instances directly
export { firebaseApp, auth, db, storage };
