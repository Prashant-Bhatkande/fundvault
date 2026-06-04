import { getToken } from "firebase/messaging";
import { getMessagingSafe } from "./firebase";

export async function requestPermission() {
  try {
    console.log("🔥 STEP 1: Starting push setup");

    const permission = await Notification.requestPermission();
    console.log("🔔 Permission:", permission);

    if (permission !== "granted") {
      console.log("❌ Permission blocked");
      return null;
    }

    const messaging = await getMessagingSafe();
    console.log("📦 Messaging:", messaging);

    if (!messaging) {
      console.log("❌ Messaging not available");
      return null;
    }

    console.log("⚙️ Registering service worker");

    const swReg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    console.log("✅ SW registered");

    await navigator.serviceWorker.ready;
    console.log("✅ SW ready");

    console.log("🚀 BEFORE GET TOKEN");

    // 🔥 FORCE EXECUTION CHECKPOINT
    await new Promise((r) => setTimeout(r, 1000));

    console.log("🚀 CALLING GET TOKEN NOW");

    const token = await getToken(messaging, {
      vapidKey:
        "BBd1RUPYOesXx6gylLIr3B4jXhJDOxcDaEnVpBHnIEnJckw2WfKRU-PaOQF1GIi7BuYwWaw4FGvs0sEDnH7gCis",
      serviceWorkerRegistration: swReg,
    });

    console.log("🎯 TOKEN RESULT:", token);

    return token;
  } catch (err) {
    console.error("💥 FULL ERROR:", err);
    return null;
  }
}