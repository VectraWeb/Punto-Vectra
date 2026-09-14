// availabilityService.js — Disponibilidad de recursos con detección de
// superposición de horarios (newStart < existingEnd && newEnd > existingStart).
// La fuente de verdad final es la transacción de escritura (reservationService),
// pero este módulo permite chequear y ofrecer alternativas sin escribir.

import { normalizeReservation, findConflictingReservations } from '../schemas/reservationSchema';

/**
 * Recursos libres para una ventana de tiempo.
 * @param {Object} params
 * @param {Object[]} params.resources - recursos normalizados
 * @param {Object[]} params.reservations - reservas crudas del día (se normalizan)
 * @param {string} params.date - YYYY-MM-DD
 * @param {string} params.service - 'mediodia' | 'cena'
 * @param {string} params.time - 'HH:mm'
 * @param {number} [params.duration] - minutos (default: 0 → solo hora exacta)
 * @param {number} [params.partySize] - si > 0 filtra por capacity
 */
export function getAvailableResources({ resources, reservations, date, service, time, duration = 0, partySize = 0 }) {
  if (!Array.isArray(resources)) return [];
  const occupied = new Set(
    (reservations || [])
      .map(normalizeReservation)
      .filter(Boolean)
      .filter(r => !['cancelado', 'no_show', 'ausente', 'finalizado'].includes(r.estado))
      .filter(r => r.liveState !== 'finalizado')
      .filter(r => r.date === date)
      .map(r => r.resourceId)
      .filter(Boolean)
  );

  return resources.filter(r => {
    if (r.status === 'inactive') return false;
    if (partySize > 0 && r.capacity > 0 && r.capacity < partySize) return false;
    if (occupied.has(r.id)) return false;

    // Chequeo fino por superposición de horarios.
    const conflicts = findConflictingReservations(
      { resourceId: r.id, date, service, time, duration },
      reservations || []
    );
    return conflicts.length === 0;
  });
}

/**
 * ¿Un recurso concreto está disponible en la ventana pedida?
 * @returns {{ available: boolean, conflicts: Object[], alternatives: Object[] }}
 */
export function checkResourceAvailability(resourceId, { resources, reservations, date, service, time, duration = 0, partySize = 0 }) {
  const conflicts = findConflictingReservations(
    { resourceId, date, service, time, duration },
    reservations || []
  );

  const available = conflicts.length === 0;
  const alternatives = available
    ? []
    : getAvailableResources({ resources, reservations, date, service, time, duration, partySize });

  return { available, conflicts, alternatives };
}
