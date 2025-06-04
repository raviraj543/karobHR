
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from "./config"; // Correctly import firebaseConfig

let app: FirebaseApp | undefined = undefined;
let auth: Auth | undefined = undefined;
let db: Firestore | undefined = undefined;
let storage: FirebaseStorage | undefined = undefined;

const CRITICAL_CONFIG_ERROR_MESSAGE =
  "CRITICAL: Firebase configuration is missing, incomplete, or uses placeholder values. " +
  "Please ensure 'firebaseConfig' is correctly exported from 'src/lib/firebase/config.ts' " +
  "and all placeholder values (like YOUR_API_KEY) have been replaced with your actual Firebase project credentials. " +
  "After updating, stop the server, delete the .next folder, and restart the server.";

// Function to initialize Firebase if not already done.
function initializeFirebaseServices() {
  if (getApps().length === 0) { // Only initialize if no apps exist
    if (!firebaseConfig) {
      console.error(CRITICAL_CONFIG_ERROR_MESSAGE + " (Reason: firebaseConfig object was not imported or is undefined).");
      return; // Exit if firebaseConfig itself is not even imported/defined
    }
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY" || firebaseConfig.apiKey.includes("PLACEHOLDER") || firebaseConfig.apiKey.length < 10) {
      console.error(CRITICAL_CONFIG_ERROR_MESSAGE + " (Reason: apiKey is missing, a placeholder, or invalid). Please verify your actual apiKey in src/lib/firebase/config.ts.");
      return; // Exit if critical apiKey is missing, a placeholder, or looks invalid
    }

    try {
      console.log("Attempting to initialize Firebase app with apiKey starting: " + firebaseConfig.apiKey.substring(0, 10) + "...");
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
      console.log("Firebase initialized successfully.");
    } catch (error) {
      console.error("Firebase initialization error during initializeApp():", error);
      // Ensure services are reset to undefined if initialization fails
      app = undefined;
      auth = undefined;
      db = undefined;
      storage = undefined;
    }
  } else {
    // console.log("Firebase app already initialized. Getting existing instance.");
    app = getApps()[0]; // Get the already initialized app
    // Ensure auth, db, storage are also assigned from this existing app
    if (app && !auth) auth = getAuth(app);
    if (app && !db) db = getFirestore(app);
    if (app && !storage) storage = getStorage(app);
  }
}

// Attempt to initialize Firebase services eagerly.
// This will run on both client and server when the module is first imported.
initializeFirebaseServices();

// Export a function to get the instances.
export const getFirebaseInstances = () => {
  // If app is not initialized (e.g. due to bad config), the variables will be undefined.
  if (!app || !auth || !db || !storage) {
    // The detailed reason should have been logged by initializeFirebaseServices.
    // This error indicates that dependent code is trying to use Firebase when it's not ready.
    const serviceErrorMsg = "Firebase services (app, auth, db, or storage) are not available. Initialization likely failed. " +
                            "Check server logs for 'CRITICAL: Firebase configuration...' messages or other initialization errors. " +
                            "Ensure 'src/lib/firebase/config.ts' is correctly populated with your actual Firebase project credentials and that the file is saved.";
    console.error("getFirebaseInstances: " + serviceErrorMsg);
    throw new Error(serviceErrorMsg);
  }
  return { app, auth, db, storage };
};

// Direct exports for convenience, but use getFirebaseInstances for guaranteed check.
// These might be undefined if initialization failed.
export { app, auth, db, storage };
