
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
  "CRITICAL: Firebase configuration (firebaseConfig) was not imported or is undefined. " +
  "This usually means 'src/lib/firebase/config.ts' is empty, not saved, or does not correctly export 'firebaseConfig'.";

const CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS =
  "CRITICAL: Firebase configuration (firebaseConfig) in 'src/lib/firebase/config.ts' still contains placeholder values (e.g., 'YOUR_API_KEY'). " +
  "Please replace ALL placeholder values with your actual Firebase project credentials from the Firebase console.";

const SERVICE_INIT_ERROR_MESSAGE =
  "Firebase services (app, auth, db, or storage) are not available. Initialization failed. " +
  "Check server logs for CRITICAL Firebase configuration messages or other initialization errors. ";

// Eagerly check the imported firebaseConfig at the module level
if (typeof firebaseConfig === 'undefined') {
  console.error(CRITICAL_CONFIG_ERROR_MESSAGE_UNDEFINED);
  throw new Error(CRITICAL_CONFIG_ERROR_MESSAGE_UNDEFINED);
}

if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY" || firebaseConfig.apiKey.includes("PLACEHOLDER")) {
  console.error(CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS);
  console.error("Current apiKey value: ", firebaseConfig?.apiKey); // Log current problematic apiKey
  throw new Error(CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS);
}

// Function to initialize Firebase if not already done.
function initializeFirebaseServices() {
  if (getApps().length === 0) { // Only initialize if no apps exist
    try {
      console.log("Attempting to initialize Firebase app with projectId: " + firebaseConfig.projectId + "...");
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
      console.log("Firebase initialized successfully with projectId: " + firebaseConfig.projectId);
    } catch (error: any) {
      console.error("Firebase initializeApp() error:", error.message || error);
      // Ensure services are reset to undefined if initialization fails
      app = undefined;
      auth = undefined;
      db = undefined;
      storage = undefined;
      // Re-throw as a more specific error
      throw new Error("Firebase initializeApp() failed: " + (error.message || error));
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
try {
  initializeFirebaseServices();
} catch (initError: any) {
  console.error("Failed to initialize Firebase services during module load:", initError.message || initError);
  // Do not throw here, let getFirebaseInstances handle throwing if services are requested when not ready
}

// Export a function to get the instances.
export const getFirebaseInstances = () => {
  if (!app || !auth || !db || !storage) {
    console.error("getFirebaseInstances: " + SERVICE_INIT_ERROR_MESSAGE);
    // Additional check for config issues, in case initializeFirebaseServices was skipped or failed silently
    if (typeof firebaseConfig === 'undefined') {
        throw new Error(CRITICAL_CONFIG_ERROR_MESSAGE_UNDEFINED + " (checked in getFirebaseInstances)");
    }
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY" || firebaseConfig.apiKey.includes("PLACEHOLDER")) {
        throw new Error(CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS + " (checked in getFirebaseInstances)");
    }
    throw new Error(SERVICE_INIT_ERROR_MESSAGE);
  }
  return { app, auth, db, storage };
};
