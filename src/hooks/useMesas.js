import { useState, useEffect, useMemo } from 'react';
import { subscribeToTableStates, subscribeToRestaurantConfig } from '../services/db_helpers';

const CONFIG_POR_DEFECTO = { cap2: 12, cap4: 12, cap5: 5, cap8: 2 };

/**
 * Convierte un valor updatedAt (Timestamp Firebase o ISO String de n8n)
 * a milisegundos UTC. Retorna null si el valor no es válido.
 */
const toMillis = (value) => {
  if (!value) return null;
  // Caso Timestamp nativo de Firebase
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  // Caso ISO 8601 (n8n) o cualquier otro valor convertible
  const parsed = new Date(value).getTime();
  return isNaN(parsed) ? null : parsed;
};

export const useMesas = (date, service) => {
  const [config, setConfig] = useState(CONFIG_POR_DEFECTO);
  const [reservations, setReservations] = useState([]);

  // Listener de configuración del restaurante — limpieza garantizada al desmontar
  useEffect(() => {
    return subscribeToRestaurantConfig(setConfig);
  }, []);

  // Listener de reservas — se re-suscribe automáticamente si cambia fecha o servicio
  useEffect(() => {
    if (!date || !service) return;
    return subscribeToTableStates(date, service, setReservations);
  }, [date, service]);

  // Lista base de mesas derivada solo cuando cambia la configuración
  const tables = useMemo(() => {
    const lista = [];
    let n = 1;
    const grupos = [
      { count: config.cap2 || 0, capacity: 2 },
      { count: config.cap4 || 0, capacity: 4 },
      { count: config.cap5 || 0, capacity: 5 },
      { count: config.cap8 || 0, capacity: 8 },
    ];
    for (const { count, capacity } of grupos) {
      for (let i = 0; i < count; i++) {
        lista.push({ id: `m${n}`, name: `M${n}`, capacity });
        n++;
      }
    }
    return lista;
  }, [config]);

  const tablesWithStatus = useMemo(() => {
    return tables.map((mesa) => {
      const reserva = reservations.find((r) => r.tableId === mesa.id) ?? null;

      let status = 'Libre';

      if (reserva) {
        // Mapa de estados en vivo → etiqueta de display
        // Corrección: Validar explícitamente el estado 'liberada' o finalizado
        if (reserva.liveState === 'liberada') {
          status = 'Libre';
        } else if (!reserva.liveState || reserva.liveState === 'esperando_cliente') {
          status = 'Reservada';
        } else {
          status = 'Ocupada';
        }
      }

      return { ...mesa, status, reservation: reserva };
    });
  }, [tables, reservations]);

  return { tables: tablesWithStatus, reservations };
};
