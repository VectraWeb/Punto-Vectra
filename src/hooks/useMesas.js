import { useState, useEffect, useMemo } from 'react';
import { subscribeToTableStates, subscribeToRestaurantConfig } from '../services/db_helpers';

const SHAPE_MAP_LOCAL = { redonda: 'round', rectangular: 'rectangular', cuadrada: 'square' };

const DEFAULT_MESA_TIPOS = [
  { id: 1, capacidad: 2, forma: 'rectangular', cantidad: 2 },
  { id: 2, capacidad: 4, forma: 'rectangular', cantidad: 2 },
  { id: 3, capacidad: 6, forma: 'redonda', cantidad: 2 },
];

function normalizeConfig(data) {
  if (!data) return DEFAULT_MESA_TIPOS;
  if (Array.isArray(data)) return data;
  if (data.mesaTipos) return data.mesaTipos;
  const groups = [
    { capacidad: 2, forma: 'rectangular', cantidad: data.cap2 || 0 },
    { capacidad: 4, forma: 'rectangular', cantidad: data.cap4 || 0 },
    { capacidad: 5, forma: 'redonda', cantidad: data.cap5 || 0 },
    { capacidad: 8, forma: 'cuadrada', cantidad: data.cap8 || 0 },
  ];
  return groups.filter(g => g.cantidad > 0);
}

/**
 * Convierte un valor updatedAt (Timestamp Firebase o ISO String de n8n)
 * a milisegundos UTC. Retorna null si el valor no es válido.
 */
const toMillis = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  const parsed = new Date(value).getTime();
  return isNaN(parsed) ? null : parsed;
};

export const useMesas = (date, service) => {
  const [config, setConfig] = useState(DEFAULT_MESA_TIPOS);
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    return subscribeToRestaurantConfig((data) => {
      setConfig(normalizeConfig(data));
    });
  }, []);

  useEffect(() => {
    if (!date || !service) return;
    return subscribeToTableStates(date, service, setReservations);
  }, [date, service]);

  const tables = useMemo(() => {
    const lista = [];
    let n = 1;
    for (const item of config) {
      const cap = item.capacidad || item.capacity || 0;
      const count = item.cantidad || 1;
      const shape = SHAPE_MAP_LOCAL[item.forma] || item.shape || 'rectangular';
      for (let i = 0; i < count; i++) {
        lista.push({ id: `m${n}`, name: `M${n}`, capacity: cap, shape });
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
        const estadosInactivos = ['cancelado', 'no_show', 'ausente'];
        const liveStatesInactivos = ['liberada', 'finalizado'];

        if (estadosInactivos.includes(reserva.estado) || liveStatesInactivos.includes(reserva.liveState)) {
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
