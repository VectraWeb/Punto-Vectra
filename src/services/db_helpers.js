import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Suscribe a los cambios en tiempo real de las reservas de una fecha y servicio.
 * Retorna la función unsubscribe para limpiar el listener al desmontar.
 *
 * @param {string} date     - Fecha en formato YYYY-MM-DD.
 * @param {string} service  - 'mediodia' | 'cena'
 * @param {Function} callback - Recibe el array de reservas actualizado.
 * @returns {Function} unsubscribe
 */
export const subscribeToTableStates = (date, service, callback) => {
  const q = query(
    collection(db, 'reservations'),
    where('date', '==', date),
    where('service', '==', service)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const reservations = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(r => r.tableId != null && !['cancelado', 'no_show', 'ausente'].includes(r.estado));
      callback(reservations);
    },
    (error) => {
      console.error(`[subscribeToTableStates] Error (${date} - ${service}):`, error);
    }
  );
};

/**
 * Suscribe a los cambios en la configuración global del restaurante.
 * Retorna la función unsubscribe para limpiar el listener al desmontar.
 *
 * @param {Function} callback - Recibe el objeto de configuración actualizado.
 * @returns {Function} unsubscribe
 */
export const subscribeToRestaurantConfig = (callback) => {
  return onSnapshot(
    doc(db, 'config', 'restaurant'),
    (snapshot) => {
      if (snapshot.exists()) callback(snapshot.data());
    },
    (error) => {
      // Ignoramos el error EN SILENCIO si es por falta de datos; no crashea la app.
      console.error('[subscribeToRestaurantConfig] Error al leer configuración:', error);
    }
  );
};
