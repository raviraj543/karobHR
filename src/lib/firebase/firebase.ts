import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from "./config";

// Immediately log that this module is being loaded.
console.log("==================================================================================");
console.log(">>> KAROBHR FIREBASE DEBUG: Attempting to load src/lib/firebase/firebase.ts module...");
console.log("==================================================================================");

let app: FirebaseApp | undefined = undefined;
let auth: Auth | undefined = undefined;
let db: Firestore | undefined = undefined;
let storage: FirebaseStorage | undefined = undefined;
let initializationError: Error | null = null;

const CRITICAL_CONFIG_MESSAGES = {
  UNDEFINED: [
    "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
    "!!! KAROBHR FIREBASE DEBUG: CRITICAL CONFIGURATION ERROR !!!",
    "!!! Firebase configuration (firebaseConfig from ./config.ts) is UNDEFINED.",
    "!!! This means 'src/lib/firebase/config.ts' might be empty, not saved,",
    "!!! or the 'firebaseConfig' object is not correctly exported.",
    "!!! PLEASE CHECK THE FILE: src/lib/firebase/config.ts",
    "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  ],
  PLACEHOLDERS: [
    "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
    "!!! KAROBHR FIREBASE DEBUG: CRITICAL CONFIGURATION ERROR !!!",
    "!!! Firebase configuration in 'src/lib/firebase/config.ts' appears to use",
    "!!! PLACEHOLDER VALUES (e.g., 'YOUR_API_KEY', 'YOUR_PROJECT_ID').",
    "!!! You MUST replace ALL placeholder values with your *ACTUAL*",
    "!!! Firebase project credentials from the Firebase Console.",
    "!!! Current apiKey for check (DO NOT SHARE REAL KEY PUBLICLY):",
    // Will be populated with actual apiKey if firebaseConfig exists
    "!!! PLEASE FIX YOUR CONFIGURATION IN: src/lib/firebase/config.ts",
    "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  ],
  INITIALIZATION_FAILED: ">>> KAROBHR FIREBASE DEBUG: Firebase initializeApp() FAILED. See details above/below. Firebase services will not be available.",
  SERVICES_NOT_READY: ">>> KAROBHR FIREBASE DEBUG: Firebase services (app, auth, db, storage) are NOT INITIALIZED. Prior initialization attempt likely failed. Check server logs for CRITICAL configuration errors or other Firebase initialization errors."
};

function logCriticalError(type: 'UNDEFINED' | 'PLACEHOLDERS', currentApiKey?: string) {
  const messages = CRITICAL_CONFIG_MESSAGES[type];
  messages.forEach(msg => {
    if (msg.includes("Current apiKey for check")) {
      console.error(`!!! Current apiKey for check: ${currentApiKey || 'N/A (firebaseConfig itself might be undefined)'}`);
    } else {
      console.error(msg);
    }
  });
}

// Eagerly check the imported firebaseConfig at the module level
if (typeof firebaseConfig === 'undefined') {
  logCriticalError('UNDEFINED');
  initializationError = new Error(CRITICAL_CONFIG_MESSAGES.UNDEFINED.join(" "));
} else if (
  !firebaseConfig ||
  !firebaseConfig.apiKey ||
  firebaseConfig.apiKey === "YOUR_API_KEY" || // Common placeholder
  firebaseConfig.apiKey.toUpperCase().includes("PLACEHOLDER") || // General placeholder check
  firebaseConfig.apiKey.toUpperCase().includes("YOUR_") || // Another common pattern
  !firebaseConfig.projectId ||
  firebaseConfig.projectId === "YOUR_PROJECT_ID" ||
  firebaseConfig.projectId.toUpperCase().includes("PLACEHOLDER") ||
  firebaseConfig.projectId.toUpperCase().includes("YOUR_")
) {
  logCriticalError('PLACEHOLDERS', firebaseConfig?.apiKey);
  initializationError = new Error(CRITICAL_CONFIG_MESSAGES.PLACEHOLDERS.join(" "));
}

// Function to initialize Firebase if not already done and no prior critical errors.
function initializeFirebaseServices() {
  // If there was a critical config error, don't even try to initialize
  if (initializationError) {
    console.error(">>> KAROBHR FIREBASE DEBUG: Skipping Firebase initialization due to prior critical configuration errors.");
    return;
  }

  if (getApps().length === 0) {
    try {
      console.log(">>> KAROBHR FIREBASE DEBUG: Attempting to initialize Firebase app with projectId: " + firebaseConfig.projectId + "...");
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
      console.log(">>> KAROBHR FIREBASE DEBUG: Firebase initialized successfully with projectId: " + firebaseConfig.projectId);
      initializationError = null; // Clear any previous non-critical init error if successful
    } catch (error: any) {
      console.error(">>> KAROBHR FIREBASE DEBUG: Firebase initializeApp() FAILED:", error.message || error);
      console.error(error); // Log the full error object
      initializationError = new Error("Firebase initializeApp() failed: " + (error.message || JSON.stringify(error)));
      // Ensure services are reset to undefined if initialization fails
      app = undefined;
      auth = undefined;
      db = undefined;
      storage = undefined;
    }
  } else {
    console.log(">>> KAROBHR FIREBASE DEBUG: Firebase app already initialized. Getting existing instance.");
    app = getApps()[0];
    if (app && !auth) auth = getAuth(app);
    if (app && !db) db = getFirestore(app);
    if (app && !storage) storage = getStorage(app);
    initializationError = null; // Assume if app exists, it was initialized correctly before
  }
}

// Attempt to initialize Firebase services eagerly if no critical config errors were found.
if (!initializationError) {
  initializeFirebaseServices();
} else {
  console.error(">>> KAROBHR FIREBASE DEBUG: Firebase initialization skipped due to configuration errors detected at module load.");
}

// Export a function to get the instances.
export const getFirebaseInstances = () => {
  // If services are not ready, first check if it's due to a known critical error.
  if (initializationError) {
    console.error(">>> KAROBHR FIREBASE DEBUG: Accessing getFirebaseInstances(), but a prior initialization error occurred.");
    console.error(initializationError.message); // Log the stored error message
    throw initializationError; // Re-throw the original error
  }

  // If there was no explicit error, but services are still not available (e.g., if initialization was skipped or failed silently somehow)
  if (!app || !auth || !db || !storage) {
    console.error(CRITICAL_CONFIG_MESSAGES.SERVICES_NOT_READY);
    // Attempt a re-initialization if not already tried or if the previous attempt failed and wasn't a config issue
    // This is a last-ditch effort.
    console.warn(">>> KAROBHR FIREBASE DEBUG: Attempting re-initialization from getFirebaseInstances()...");
    initializeFirebaseServices(); // Try again
    if (!app || !auth || !db || !storage) { // If still not initialized
        if (initializationError) throw initializationError; // if initializeFirebaseServices set an error
        throw new Error(CRITICAL_CONFIG_MESSAGES.SERVICES_NOT_READY + " Re-initialization also failed.");
    }
  }
  
  console.log(">>> KAROBHR FIREBASE DEBUG: getFirebaseInstances() providing Firebase services. Auth ready: " + !!auth);
  return { app, auth, db, storage, error: initializationError }; // Return error state as well
};
