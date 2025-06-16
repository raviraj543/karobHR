
// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
  projectId: "karobhr-app",
  appId: "1:173193434755:web:ff524a012e3ad42bff2db6",
  storageBucket: "karobhr-app.firebasestorage.app",
  apiKey: "AIzaSyCP67K069RaS0kRF_2RrwkyMkit6KpYtVU",
  authDomain: "karobhr-app.firebaseapp.com",
  messagingSenderId: "173193434755",
  measurementId: "G-PTWL6WSMHZ"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();
