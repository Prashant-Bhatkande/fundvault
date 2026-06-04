import { initializeApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

// 🔥 REPLACE ONLY THIS WITH YOUR FIREBASE CONSOLE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDvpRIDF5RgzgQB9_32pRztK7DUmbrcb1I",
  authDomain: "fundvault1.firebaseapp.com",
  projectId: "fundvault1",
  storageBucket: "fundvault1.firebasestorage.app",
  messagingSenderId: "1098566355270",
  appId: "1:1098566355270:web:8bf1c2e4d66f5c6dd7bd47"
};

const app = initializeApp(firebaseConfig);

export async function getMessagingSafe() {
  const supported = await isSupported();
  if (!supported) return null;

  return getMessaging(app);
}