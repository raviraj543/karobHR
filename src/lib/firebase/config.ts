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
  apiKey: "AIzaSyCP67K069RaS0kRF_2RrwkyMkit6KpYtVU",
  authDomain: "karobhr-app.firebaseapp.com",
  projectId: "karobhr-app",
  storageBucket: "karobhr-app.firebasestorage.app",
  messagingSenderId: "173193434755",
  appId: "1:173193434755:web:ade88ec8193ca04dff2db6",
  measurementId: "G-YDWNN7RCWP"
};
