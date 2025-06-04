
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
      // Check if firebaseConfig exists and then if it has placeholder values
      if (!firebaseConfig) {
        console.error(
          "CRITICAL: Firebase configuration is missing. " +
          "Please ensure 'firebaseConfig' is exported from src/lib/firebase/config.ts " +
          "and contains your actual Firebase project credentials."
        );
        // Initialization will fail if firebaseConfig is not provided to initializeApp
      } else if (firebaseConfig.apiKey === "YOUR_API_KEY" || !firebaseConfig.apiKey) {
        console.warn(
          "Firebase config might be using placeholder values or is incomplete. " +
          "Please update src/lib/firebase/config.ts with your actual Firebase project credentials."
        );
      }

      // Only attempt to initialize if firebaseConfig is defined
      if (firebaseConfig && firebaseConfig.apiKey) { // Added check for apiKey to ensure config is somewhat valid
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        console.log("Firebase initialized.");
      } else {
        console.error("Firebase initialization skipped due to missing or incomplete configuration. Check src/lib/firebase/config.ts.");
      }
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
  if (!app && typeof window !== "undefined") {
    if (!getApps().length) {
       if (!firebaseConfig) {
          console.error(
            "CRITICAL: Firebase configuration is missing inside getFirebaseInstances. " +
            "Please ensure 'firebaseConfig' is exported from src/lib/firebase/config.ts."
          );
       } else if (firebaseConfig.apiKey === "YOUR_API_KEY" || !firebaseConfig.apiKey) {
        console.warn(
          "Firebase config might be using placeholder values or is incomplete inside getFirebaseInstances. " +
          "Please update src/lib/firebase/config.ts."
        );
      }
      
      if (firebaseConfig && firebaseConfig.apiKey) { // Added check for apiKey
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
      } else {
         console.error("Firebase initialization skipped in getFirebaseInstances due to missing or incomplete configuration.");
      }
    } else {
      app = getApps()[0];
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
    }
  }

  if (!app) {
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      console.error("Firebase app instance is not available due to missing/incomplete configuration. Ensure src/lib/firebase/config.ts is correctly set up and populated.");
    } else {
      console.error("Firebase app instance is not available, but configuration seems present. Check initialization logs for other errors.");
    }
  }
  return { app, auth, db, storage };
};

// Direct exports are also possible but be mindful of initialization timing
export { app, auth, db, storage };
