// src/lib/firebase/config.ts

// =================================================================================================
// == CRITICAL CONFIGURATION REQUIRED ==
// =================================================================================================
//
// !! PLEASE READ AND FOLLOW THESE INSTRUCTIONS CAREFULLY !!
//
// 1. **REPLACE PLACEHOLDERS**: You MUST replace all placeholder values below
//    (e.g., "YOUR_API_KEY", "YOUR_PROJECT_ID") with your *ACTUAL* Firebase
//    project credentials.
//
// 2. **GET YOUR CREDENTIALS**: Find these credentials in your Firebase project settings:
//    - Go to the Firebase Console (https://console.firebase.google.com/).
//    - Select your project.
//    - Click on the gear icon (⚙️) for "Project settings".
//    - In the "General" tab, scroll down to the "Your apps" section.
//    - If you haven't added a web app, do so.
//    - Find your web app and look for the "SDK setup and configuration" section.
//    - Select "Config" (it's usually a radio button or a small code snippet).
//    - Copy the corresponding values (apiKey, authDomain, projectId, etc.) from there.
//
// 3. **SAVE THIS FILE**: After replacing the placeholders, ensure this file is saved.
//    The `export const firebaseConfig = { ... };` line MUST be present.
//
// 4. **RESTART YOUR SERVER CLEANLY**:
//    - Stop your Next.js development server (Ctrl+C in the terminal).
//    - Delete the ".next" folder from your project root.
//    - Restart the server (e.g., npm run dev).
//
// If these steps are not followed, your application WILL NOT connect to Firebase
// and you WILL continue to see errors.
//
// =================================================================================================

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // <-- REPLACE THIS WITH YOUR ACTUAL API KEY
  authDomain: "YOUR_AUTH_DOMAIN", // <-- REPLACE THIS (e.g., your-project-id.firebaseapp.com)
  projectId: "YOUR_PROJECT_ID", // <-- REPLACE THIS
  storageBucket: "YOUR_STORAGE_BUCKET", // <-- REPLACE THIS (e.g., your-project-id.appspot.com)
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // <-- REPLACE THIS
  appId: "YOUR_APP_ID", // <-- REPLACE THIS (e.g., 1:xxxx:web:xxxx)
  measurementId: "YOUR_MEASUREMENT_ID" // Optional: REPLACE if you use Google Analytics, otherwise it can be an empty string or removed if not present in your Firebase config.
};
