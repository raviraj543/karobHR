// Follow this pattern to import other Firebase services as needed.
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDVcbhLASfYQ0wpr4DyhngZqvClEG6qT1s",
  authDomain: "automation-4e6bd.firebaseapp.com",
  projectId: "automation-4e6bd",
  storageBucket: "automation-4e6bd.firebasestorage.app",
  messagingSenderId: "790882259931",
  appId: "1:790882259931:web:ed6ca2966b80cc2eb5cdfe",
  measurementId: "G-KK07ZQS39Z"
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage, firebaseConfig };
