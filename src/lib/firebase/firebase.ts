
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from "./config"; // Correctly import firebaseConfig

let app: FirebaseApp | undefined = undefined;
let auth: Auth | undefined = undefined;
let db: Firestore | undefined = undefined;
let storage: FirebaseStorage | undefined = undefined;

const CRITICAL_CONFIG_ERROR_MESSAGE_UNDEFINED =
  ">>> KAROBHR DEBUG: CRITICAL FIREBASE CONFIGURATION ERROR! The 'firebaseConfig' object was not found or not exported correctly from 'src/lib/firebase/config.ts'. Please ensure the file exists, is saved, and correctly exports 'firebaseConfig'.";

const CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS =
  ">>> KAROBHR DEBUG: CRITICAL FIREBASE CONFIGURATION ERROR! The 'firebaseConfig' in 'src/lib/firebase/config.ts' still contains placeholder values (e.g., 'YOUR_API_KEY' or includes 'PLACEHOLDER'). You MUST replace ALL placeholder values with your actual Firebase project credentials from the Firebase console. Then, save the file, delete the .next folder, and restart the server.";

const SERVICE_INIT_ERROR_MESSAGE =
  ">>> KAROBHR DEBUG: Firebase services (app, auth, db, or storage) are not available. Initialization likely failed. Check terminal logs for more specific CRITICAL Firebase configuration messages or other initialization errors.";

// Eagerly check the imported firebaseConfig at the module level
if (typeof firebaseConfig === 'undefined') {
  console.error(CRITICAL_CONFIG_ERROR_MESSAGE_UNDEFINED);
  throw new Error(CRITICAL_CONFIG_ERROR_MESSAGE_UNDEFINED);
}

if (
  !firebaseConfig ||
  !firebaseConfig.apiKey || // Check if apiKey is defined
  firebaseConfig.apiKey === "YOUR_API_KEY" || // Check if it's the exact placeholder
  (typeof firebaseConfig.apiKey === 'string' && firebaseConfig.apiKey.includes("PLACEHOLDER")) || // Check if it contains "PLACEHOLDER"
  !firebaseConfig.projectId || // Check for other critical fields
  firebaseConfig.projectId === "YOUR_PROJECT_ID" ||
  (typeof firebaseConfig.projectId === 'string' && firebaseConfig.projectId.includes("PLACEHOLDER"))
) {
  console.error(CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS);
  console.error(">>> KAROBHR DEBUG: Current apiKey value: ", firebaseConfig?.apiKey);
  console.error(">>> KAROBHR DEBUG: Current projectId value: ", firebaseConfig?.projectId);
  throw new Error(CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS);
}

// Function to initialize Firebase if not already done.
function initializeFirebaseServices() {
  if (getApps().length === 0) { // Only initialize if no apps exist
    try {
      console.log(">>> KAROBHR DEBUG: Attempting to initialize Firebase app with projectId: " + firebaseConfig.projectId + "...");
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
      console.log(">>> KAROBHR DEBUG: Firebase initialized successfully with projectId: " + firebaseConfig.projectId);
    } catch (error: any) {
      console.error(">>> KAROBHR DEBUG: Firebase initializeApp() error:", error.message || error);
      app = undefined; auth = undefined; db = undefined; storage = undefined;
      throw new Error(">>> KAROBHR DEBUG: Firebase initializeApp() failed: " + (error.message || error));
    }
  } else {
    app = getApps()[0];
    if (app && !auth) auth = getAuth(app);
    if (app && !db) db = getFirestore(app);
    if (app && !storage) storage = getStorage(app);
  }
}

// Attempt to initialize Firebase services eagerly.
try {
  initializeFirebaseServices();
} catch (initError: any) {
  console.error(">>> KAROBHR DEBUG: Failed to initialize Firebase services during module load:", initError.message || initError);
  // Do not throw here if already thrown by placeholder checks; let getFirebaseInstances handle it if services are still requested.
}

// Export a function to get the instances.
export const getFirebaseInstances = () => {
  if (!app || !auth || !db || !storage) {
    console.error(">>> KAROBHR DEBUG: getFirebaseInstances called, but services are not ready. This indicates an earlier initialization failure.");
    // Re-check config issues as a last resort, though initial checks should have caught them.
    if (typeof firebaseConfig === 'undefined') {
        throw new Error(CRITICAL_CONFIG_ERROR_MESSAGE_UNDEFINED + " (checked in getFirebaseInstances)");
    }
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY" || (typeof firebaseConfig.apiKey === 'string' && firebaseConfig.apiKey.includes("PLACEHOLDER"))) {
        throw new Error(CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS + " (checked in getFirebaseInstances)");
    }
    throw new Error(SERVICE_INIT_ERROR_MESSAGE);
  }
  return { app, auth, db, storage };
};
