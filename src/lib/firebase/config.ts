// Follow this pattern to import other Firebase services as needed.
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    projectId: "karobhr-app",
    appId: "1:173193434755:web:ade88ec8193ca04dff2db6",
    storageBucket: "karobhr-app.firebasestorage.app",
    apiKey: "AIzaSyCP67K069RaS0kRF_2RrwkyMkit6KpYtVU",
    authDomain: "karobhr-app.firebaseapp.com",
    messagingSenderId: "173193434755",
    measurementId: "G-YDWNN7RCWP"
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
