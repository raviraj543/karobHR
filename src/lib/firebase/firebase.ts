
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from "./config";

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (typeof window !== "undefined" && !getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("Firebase initialized successfully!");
  } catch (error) {
    console.error("Firebase initialization error:", error);
    // You might want to throw the error or handle it in a way that
    // makes it clear to the developer that Firebase setup failed.
    // For now, app, auth, db, storage will remain undefined if init fails.
  }
} else if (getApps().length) {
  // If already initialized, get the default app
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

// Export a function to get the instances, ensures they are initialized
export const getFirebaseInstances = () => {
  if (!app) {
    // This case might happen if the app is not initialized on the client,
    // or if this module is somehow accessed on the server where it wasn't meant to.
    // Consider how to handle this based on your app's architecture.
    // For client-side Next.js, the above `if (typeof window !== "undefined" ...)` should handle it.
    if (typeof window !== "undefined" && !getApps().length) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
    } else if (getApps().length) {
        app = getApps()[0];
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
    } else {
        // This is a fallback, ideally initialization should succeed.
        // throw new Error("Firebase has not been initialized. Ensure firebase.ts is imported and config is correct.");
        console.warn("Firebase called before initialization or on server without app instance.");
    }
  }
  return { app, auth, db, storage };
};

// Direct exports are also possible but be mindful of initialization timing
export { app, auth, db, storage };
