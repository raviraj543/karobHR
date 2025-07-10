
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getMessaging, type Messaging } from "firebase/messaging";
import { firebaseConfig } from './config';

let firebaseApp: FirebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

const auth: Auth = getAuth(firebaseApp);
const db: Firestore = getFirestore(firebaseApp);
const storage: FirebaseStorage = getStorage(firebaseApp);

let messaging: Messaging | null = null;

// Only initialize messaging in the browser
if (typeof window !== 'undefined') {
  try {
    messaging = getMessaging(firebaseApp);
  } catch (error) {
    console.error("Failed to initialize Firebase Messaging:", error);
    // This might happen if the browser doesn't support it (e.g., in an iframe or private mode)
  }
}

export { firebaseApp, auth, db, storage, messaging };
