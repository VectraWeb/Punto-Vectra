// firebase.js — Andi MVP
// Inicialización del cliente Firebase adaptado a Vite con soporte para Emulador Local y persistencia offline

import { initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator, // ◄ Agregamos la conexión para pruebas locales
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';

// ─── Configuración de credenciales (Usa import.meta.env para Vite) ───────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || "local-dummy-key",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "localhost",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || "andi-mvp-local",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "localhost",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || "1:123:web:abc12345",
};

// Inicializar Firebase App
const app = initializeApp(firebaseConfig);

// Inicializar Firestore usando la sintaxis moderna de Vite para PWA (Soporta múltiples pestañas offline)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// 🚀 CONECTAR AL EMULADOR SOLO SI SE ACTIVA EN EL ARCHIVO .env (VITE_USE_EMULATOR=true)
if (window.location.hostname === "localhost" && import.meta.env.VITE_USE_EMULATOR === "true") {
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.info('[Andi] Conectado con éxito al emulador local de Firestore (Puerto 8080) ✓');
}

export default app;