
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from "./config"; // Correctly import firebaseConfig

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// Ensure Firebase is initialized only on the client-side and only once
if (typeof window !== "undefined") {
  if (!getApps().length) {
    try {
      // Check if firebaseConfig has placeholder values
      if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.warn(
          "Firebase config is using placeholder values. " +
          "Please update src/lib/firebase/config.ts with your actual Firebase project credentials."
        );
      }
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
      console.log("Firebase initialized.");
    } catch (error) {
      console.error("Firebase initialization error:", error);
      // Fallback or error display might be needed here for the user
    }
  } else {
    // If already initialized, get the default app
    app = getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  }
}

// Export a function to get the instances, ensures they are initialized if called
export const getFirebaseInstances = () => {
  // This function might be called before the initial client-side check completes,
  // so we repeat the initialization logic if 'app' is not yet defined.
  // This is more of a safeguard.
  if (!app && typeof window !== "undefined") {
    if (!getApps().length) {
       if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.warn(
          "Firebase config is using placeholder values inside getFirebaseInstances. " +
          "Please update src/lib/firebase/config.ts."
        );
      }
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
    } else {
      app = getApps()[0];
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
    }
  }
  if (!app) {
    // This case implies server-side execution or failed init.
    // For client-side Next.js, this should ideally not be hit if setup is correct.
    // Throwing an error or specific handling might be needed for server-side contexts.
    console.error("Firebase has not been initialized. Ensure firebase.ts is correctly set up and config is populated.");
  }
  return { app, auth, db, storage };
};

// Direct exports are also possible but be mindful of initialization timing
export { app, auth, db, storage };
