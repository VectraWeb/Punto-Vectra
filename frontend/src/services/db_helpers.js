// db_helpers.js — Suscripciones y consultas mediante API REST.

import { reservationApi, configApi } from './api';

/**
 * Obtiene las reservas de una fecha y servicio.
 */
export const subscribeToTableStates = (date, service, callback) => {
  let cancelled = false;

  const fetchReservations = async () => {
    if (cancelled) return;
    try {
      const { data } = await reservationApi.getAll({ date, service });
      const reservations = (data || [])
        .filter(r => r.tableId != null && !['cancelado', 'no_show', 'ausente'].includes(r.estado));
      callback(reservations);
    } catch (error) {
      console.error(`[subscribeToTableStates] Error (${date} - ${service}):`, error);
    }
  };

  fetchReservations();

  const interval = setInterval(fetchReservations, 10000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
};

/**
 * Obtiene la configuración del restaurante.
 */
export const subscribeToRestaurantConfig = (callback) => {
  let cancelled = false;

  const fetchConfig = async () => {
    if (cancelled) return;
    try {
      const { data } = await configApi.getById('restaurant');
      callback(data);
    } catch (error) {
      console.error('[subscribeToRestaurantConfig] Error:', error);
    }
  };

  fetchConfig();

  const interval = setInterval(fetchConfig, 30000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
};
