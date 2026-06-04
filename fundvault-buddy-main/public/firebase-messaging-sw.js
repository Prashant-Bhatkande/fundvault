importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDvpRIDF5RgzgQB9_32pRztK7DUmbrcb1I",
  authDomain: "fundvault1.firebaseapp.com",
  projectId: "fundvault1",
  storageBucket: "fundvault1.firebasestorage.app",
  messagingSenderId: "1098566355270",
  appId: "1:1098566355270:web:8bf1c2e4d66f5c6dd7bd47"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(
    payload.notification?.title || "Notification",
    {
      body: payload.notification?.body || "New message",
    }
  );
});