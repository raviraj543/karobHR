
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from "./config"; // Correctly import firebaseConfig

let app: FirebaseApp | undefined = undefined;
let auth: Auth | undefined = undefined;
let db: Firestore | undefined = undefined;
let storage: FirebaseStorage | undefined = undefined;

const PREFIX = ">>> KAROBHR FIREBASE DEBUG: ";

const CRITICAL_CONFIG_ERROR_MESSAGE_UNDEFINED =
  PREFIX + "CRITICAL CONFIGURATION ERROR! The 'firebaseConfig' object was not found or not exported correctly from 'src/lib/firebase/config.ts'. " +
  "Please ensure the file exists, is saved, and correctly exports 'firebaseConfig'. The application cannot start without it.";

const CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS =
  PREFIX + "CRITICAL CONFIGURATION ERROR! The 'firebaseConfig' in 'src/lib/firebase/config.ts' still contains placeholder values (e.g., 'YOUR_API_KEY' or includes 'PLACEHOLDER'). " +
  "You MUST replace ALL placeholder values with your actual Firebase project credentials from the Firebase console. Then, save the file, delete the .next folder, and restart the server.";

const SERVICE_INIT_ERROR_MESSAGE_GENERIC =
  PREFIX + "SERVICE INITIALIZATION FAILED! Firebase services (app, auth, db, or storage) are not available. " +
  "This usually means Firebase initialization failed. Check this server terminal output carefully for more specific 'CRITICAL CONFIGURATION ERROR' messages or 'Firebase initializeApp() error' messages above this one.";

// Eagerly check the imported firebaseConfig at the module level
if (typeof firebaseConfig === 'undefined') {
  console.error(CRITICAL_CONFIG_ERROR_MESSAGE_UNDEFINED);
  // Throwing here will stop the server startup if config.ts is fundamentally broken.
  throw new Error(CRITICAL_CONFIG_ERROR_MESSAGE_UNDEFINED);
}

// Check for placeholder values
if (
  !firebaseConfig || // General check it's not null/empty if somehow it wasn't undefined
  !firebaseConfig.apiKey || // Check if apiKey is defined and not empty
  firebaseConfig.apiKey === "YOUR_API_KEY" || // Check if it's the exact placeholder
  (typeof firebaseConfig.apiKey === 'string' && firebaseConfig.apiKey.includes("PLACEHOLDER")) || // Check if it contains "PLACEHOLDER"
  !firebaseConfig.projectId || // Check for other critical fields like projectId
  firebaseConfig.projectId === "YOUR_PROJECT_ID" ||
  (typeof firebaseConfig.projectId === 'string' && firebaseConfig.projectId.includes("PLACEHOLDER"))
) {
  console.error(CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS);
  console.error(PREFIX + "Current problematic apiKey (if available): ", firebaseConfig?.apiKey);
  console.error(PREFIX + "Current problematic projectId (if available): ", firebaseConfig?.projectId);
  // Throwing here will stop the server startup if config.ts has placeholders.
  throw new Error(CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS);
}

// Function to initialize Firebase if not already done.
function initializeFirebaseServices() {
  if (getApps().length === 0) { // Only initialize if no apps exist
    try {
      console.log(PREFIX + "Attempting to initialize Firebase app with actual projectId: " + firebaseConfig.projectId + "...");
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
      console.log(PREFIX + "Firebase initialized successfully with actual projectId: " + firebaseConfig.projectId);
    } catch (error: any) {
      console.error(PREFIX + "Firebase initializeApp() error during first-time initialization:", error.message || error);
      // Ensure services are reset to undefined if initialization fails
      app = undefined;
      auth = undefined;
      db = undefined;
      storage = undefined;
      // Re-throw as a more specific error to be caught by the module-level try/catch
      throw new Error(PREFIX + "Firebase initializeApp() FAILED: " + (error.message || error));
    }
  } else {
    // This case handles Fast Refresh or other scenarios where the module might be re-evaluated.
    app = getApps()[0]; // Get the already initialized app
    // Ensure auth, db, storage are also assigned from this existing app if not already
    if (app && !auth) auth = getAuth(app);
    if (app && !db) db = getFirestore(app);
    if (app && !storage) storage = getStorage(app);
     // console.log(PREFIX + "Firebase app already initialized. Using existing instance for projectId: " + (app.options.projectId || "N/A"));
  }
}

// Attempt to initialize Firebase services eagerly at module load.
try {
  initializeFirebaseServices();
} catch (initError: any) {
  // This catch is for errors specifically from initializeApp() if it was thrown from within initializeFirebaseServices
  console.error(PREFIX + "CRITICAL ERROR during Firebase module load initialization:", initError.message || initError);
  // `app`, `auth`, etc., would have been reset to undefined by the throw in initializeFirebaseServices.
}

// Export a function to get the instances.
export const getFirebaseInstances = () => {
  // If services are not ready, try to initialize them again.
  // This is defensive, in case the eager initialization failed or was reset.
  if (!app || !auth || !db || !storage) {
    console.warn(PREFIX + "getFirebaseInstances() called, but services were not ready. Attempting re-initialization...");
    initializeFirebaseServices(); // Attempt to re-initialize

    // After attempting re-initialization, check again.
    if (!app || !auth || !db || !storage) {
      console.error(PREFIX + "RE-INITIALIZATION FAILED. Firebase services are still not available.");
      // Additional check for config issues, in case initializeFirebaseServices was skipped or failed silently
      if (typeof firebaseConfig === 'undefined') {
          console.error(PREFIX + CRITICAL_CONFIG_ERROR_MESSAGE_UNDEFINED + " (checked in getFirebaseInstances after re-init attempt)");
          throw new Error(CRITICAL_CONFIG_ERROR_MESSAGE_UNDEFINED + " (checked in getFirebaseInstances after re-init attempt)");
      }
      if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY" || firebaseConfig.apiKey.includes("PLACEHOLDER")) {
          console.error(PREFIX + CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS + " (checked in getFirebaseInstances after re-init attempt)");
          console.error(PREFIX + "Current problematic apiKey (if available) during getFirebaseInstances: ", firebaseConfig?.apiKey);
          throw new Error(CRITICAL_CONFIG_ERROR_MESSAGE_PLACEHOLDERS + " (checked in getFirebaseInstances after re-init attempt)");
      }
      // If config seems okay but init failed, throw the generic service error
      throw new Error(SERVICE_INIT_ERROR_MESSAGE_GENERIC + " (after re-init attempt)");
    }
    console.log(PREFIX + "Services re-initialized successfully within getFirebaseInstances.");
  }
  return { app, auth, db, storage };
};
