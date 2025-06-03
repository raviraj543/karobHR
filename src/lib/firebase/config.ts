// src/lib/firebase/config.ts

// IMPORTANT: Replace these placeholder values with your actual
// Firebase project configuration details from the Firebase console.
export const firebaseConfig = {
  apiKey: "AIzaSyCP67K069RaS0kRF_2RrwkyMkit6KpYtVU",
  authDomain: "karobhr-app.firebaseapp.com",
  projectId: "karobhr-app",
  storageBucket: "karobhr-app.firebasestorage.app",
  messagingSenderId: "173193434755",
  appId: "1:173193434755:web:ade88ec8193ca04dff2db6",
  measurementId: "G-YDWNN7RCWP"
};// Suggested code may be subject to a license. Learn more: ~LicenseLog:2586528828.
// Suggested code may be subject to a license. Learn more: ~LicenseLog:79595689.
// Suggested code may be subject to a license. Learn more: ~LicenseLog:400676626.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
