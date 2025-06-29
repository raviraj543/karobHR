
// This is the service worker for Firebase Cloud Messaging.

// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// This is the placeholder for the Workbox manifest.
// The next-pwa plugin will replace this with a list of all your app's files.
self.__WB_MANIFEST;

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
  apiKey: "AIzaSyDVcbhLASfYQ0wpr4DyhngZqvClEG6qT1s",
  authDomain: "automation-4e6bd.firebaseapp.com",
  projectId: "automation-4e6bd",
  storageBucket: "automation-4e6bd.firebasestorage.app",
  messagingSenderId: "790882259931",
  appId: "1:790882259931:web:ed6ca2966b80cc2eb5cdfe",
  measurementId: "G-KK07ZQS39Z"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();
