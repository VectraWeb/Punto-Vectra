// reservationStates.js — Máquina de estados de reservas (centralizada).
// Compatibilidad con estados legacy: pendiente=pending, confirmada=confirmed,
// cancelado=cancelled. liveState (máquina del mozo, restaurante) se mantiene
// separado y sigue funcionando igual.

import { domainError, ERROR_CODES } from '../core/errors';
import { DOMAIN_EVENTS } from '../core/events';

export const RESERVATION_STATUSES = [
  'pending', 'confirmed', 'checked_in', 'in_progress', 'completed',
  'cancelled', 'no_show', 'expired',
];

export const RESERVATION_STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  checked_in: 'Presente',
  in_progress: 'En curso',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
  expired: 'Vencida',
};

export const LEGACY_TO_STATUS = {
  pendiente: 'pending',
  confirmada: 'confirmed',
  cancelado: 'cancelled',
  no_show: 'no_show',
};

export const STATUS_TO_LEGACY = {
  pending: 'pendiente',
  confirmed: 'confirmada',
  checked_in: 'confirmada',
  in_progress: 'confirmada',
  completed: 'confirmada',
  cancelled: 'cancelado',
  no_show: 'no_show',
  expired: 'cancelado',
};

export const RESERVATION_TRANSITIONS = {
  pending: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['checked_in', 'cancelled', 'no_show', 'expired'],
  checked_in: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
  expired: [],
};

export function reservationStatusOf(reservation) {
  if (reservation?.status && RESERVATION_STATUSES.includes(reservation.status)) {
    return reservation.status;
  }
  const legacy = LEGACY_TO_STATUS[reservation?.estado];
  return legacy || 'pending';
}

export function canTransitionReservation(from, to) {
  if (!RESERVATION_STATUSES.includes(from) || !RESERVATION_STATUSES.includes(to)) return false;
  return (RESERVATION_TRANSITIONS[from] || []).includes(to);
}

/** Valida y normaliza una transición; lanza INVALID_STATUS_TRANSITION. */
export function assertValidTransition(current, next) {
  const from = typeof current === 'string' ? current : reservationStatusOf(current);
  if (!canTransitionReservation(from, next)) {
    throw domainError(
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      `Transición inválida: ${from} → ${next}`
    );
  }
  return next;
}

export function eventForStatus(status) {
  const map = {
    confirmed: DOMAIN_EVENTS.RESERVATION_CONFIRMED,
    checked_in: DOMAIN_EVENTS.RESERVATION_CHECKED_IN,
    in_progress: DOMAIN_EVENTS.RESERVATION_IN_PROGRESS,
    completed: DOMAIN_EVENTS.RESERVATION_COMPLETED,
    cancelled: DOMAIN_EVENTS.RESERVATION_CANCELLED,
    no_show: DOMAIN_EVENTS.RESERVATION_NO_SHOW,
    expired: DOMAIN_EVENTS.RESERVATION_EXPIRED,
  };
  return map[status] || null;
}
