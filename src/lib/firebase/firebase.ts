import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from "./config";

// Immediately log that this module is being loaded.
console.log("==================================================================================");
console.log(">>> KAROBHR FIREBASE DEBUG: Attempting to load src/lib/firebase/firebase.ts module...");
console.log("==================================================================================");


let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

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

function initializeFirebase() {
    if (typeof firebaseConfig === 'undefined') {
        logCriticalError('UNDEFINED');
        throw new Error(CRITICAL_CONFIG_MESSAGES.UNDEFINED.join(" "));
    }
    if (
      !firebaseConfig ||
      !firebaseConfig.apiKey ||
      firebaseConfig.apiKey === "YOUR_API_KEY" ||
      firebaseConfig.apiKey.toUpperCase().includes("PLACEHOLDER") ||
      !firebaseConfig.projectId ||
      firebaseConfig.projectId.toUpperCase().includes("PLACEHOLDER")
    ) {
        logCriticalError('PLACEHOLDERS', firebaseConfig?.apiKey);
        throw new Error(CRITICAL_CONFIG_MESSAGES.PLACEHOLDERS.join(" "));
    }

    try {
        app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        console.log(">>> KAROBHR FIREBASE DEBUG: Firebase initialized/retrieved successfully. Project ID: " + app.options.projectId);
    } catch (error: any) {
        console.error(">>> KAROBHR FIREBASE DEBUG: Firebase initializeApp() FAILED:", error.message || error);
        throw new Error("Firebase initializeApp() failed: " + (error.message || "Unknown error"));
    }
}


export const getFirebaseInstances = () => {
  // Initialize on first call if not already initialized.
  if (!app) {
    console.log(">>> KAROBHR FIREBASE DEBUG: getFirebaseInstances called, services not yet initialized. Initializing now...");
    initializeFirebase();
  } else {
    console.log(">>> KAROBHR FIREBASE DEBUG: getFirebaseInstances called, services already initialized.");
  }

  if (!app || !auth || !db || !storage) {
     console.error(CRITICAL_CONFIG_MESSAGES.SERVICES_NOT_READY);
     throw new Error(CRITICAL_CONFIG_MESSAGES.SERVICES_NOT_READY);
  }

  console.log(">>> KAROBHR FIREBASE DEBUG: getFirebaseInstances() providing Firebase services. Auth ready: " + !!auth);
  return { app, auth, db, storage, error: null };
};
