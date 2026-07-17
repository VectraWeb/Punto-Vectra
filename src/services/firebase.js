// firebase.js — Andi MVP
// Inicialización del cliente Firebase con persistencia offline habilitada

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  enableIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED,
} from 'firebase/firestore';

// ─── Reemplazá estos valores con los de tu proyecto en Firebase Console ───────
// https://console.firebase.google.com → Configuración del proyecto → Tus apps
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Inicializar Firebase App
const app = initializeApp(firebaseConfig);

// Inicializar Firestore con caché ilimitada
export const db = getFirestore(app);

// Activar persistencia offline (IndexedDB)
// Permite que mozos en zonas de baja señal Wi-Fi sigan registrando estados;
// las escrituras se sincronizan automáticamente cuando vuelve la conexión.
enableIndexedDbPersistence(db, { cacheSizeBytes: CACHE_SIZE_UNLIMITED })
  .then(() => {
    console.info('[Andi] Persistencia offline activada ✓');
  })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      // Múltiples tabs abiertas — la persistencia solo funciona en una a la vez
      console.warn('[Andi] Persistencia offline: múltiples pestañas detectadas. Solo una pestaña puede tener persistencia activa.');
    } else if (err.code === 'unimplemented') {
      // El navegador no soporta IndexedDB
      console.warn('[Andi] Este navegador no soporta persistencia offline.');
    }
  });

export default app;

// ─── Estructura de datos en Firestore ─────────────────────────────────────────
//
// Colección: reservations/{reservationId}
// {
//   id:           string   — ID único (formato "r{timestamp}")
//   customerName: string
//   phone:        string   — Opcional
//   partySize:    number
//   tableId:      string   — ej. "m1" (null si pendiente)
//   mesa_id:      string   — ej. "m1" (null si pendiente)
//   time:         string   — ej. "20:00"
//   duration:     number   — minutos
//   service:      string   — "mediodia" | "cena"
//   date:         string   — "YYYY-MM-DD"
//   notes:        string   — Opcional
//   estado:       string   — "pendiente" | "confirmada"
//   liveState:    string   — Estado en vivo del mozo
//   createdAt:    timestamp
//   updatedAt:    timestamp
// }
//
// Colección: mesasReservadas/{m{tableId}_{date}_{service}}
// {
//   occupied:       boolean  — true cuando la mesa está ocupada
//   reservationId:  string
//   time:           string
//   partySize:      number
// }
//
// Colección: config/restaurant
// {
//   cap2: number, cap4: number, cap5: number, cap8: number
// }
