
// src/lib/firebase/config.ts

// >>> VERY IMPORTANT <<<
// 1. REPLACE ALL PLACEHOLDER VALUES BELOW (e.g., "YOUR_API_KEY")
//    WITH YOUR ACTUAL FIREBASE PROJECT CREDENTIALS FROM THE FIREBASE CONSOLE.
// 2. MAKE SURE THIS FILE IS SAVED.
// 3. ENSURE THE `export const firebaseConfig = { ... };` LINE IS EXACTLY AS SHOWN.

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // REPLACE THIS
  authDomain: "YOUR_AUTH_DOMAIN", // REPLACE THIS (e.g., your-project-id.firebaseapp.com)
  projectId: "YOUR_PROJECT_ID", // REPLACE THIS
  storageBucket: "YOUR_STORAGE_BUCKET", // REPLACE THIS (e.g., your-project-id.appspot.com)
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // REPLACE THIS
  appId: "YOUR_APP_ID", // REPLACE THIS (e.g., 1:xxxx:web:xxxx)
  measurementId: "YOUR_MEASUREMENT_ID" // Optional, REPLACE if you use Google Analytics
};
