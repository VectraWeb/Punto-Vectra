// reservationSchema.js — Normalización de reservas + lógica de superposición.
// Compatibilidad: reservas viejas (mesa_id / tableId / fecha / hora) se leen
// sin migración: resourceId se resuelve como resourceId || tableId || mesa_id.

import { t2m } from '../utils';
import { DEFAULT_ORG_ID } from '../config/businessTypes';

// ─── Normalización ───────────────────────────────────────────────────────────

/**
 * Vista genérica de una reserva, sin mutar el documento original.
 * @param {Object} r - Doc de reservations/{id}
 * @returns {Object} original + { resourceId, organizationId, startTime, endTime, metadata }
 */
export function normalizeReservation(r) {
  if (!r) return null;
  const resourceId = r.resourceId || r.tableId || r.mesa_id || null;
  const organizationId = r.organizationId || DEFAULT_ORG_ID;
  const metadata = (r.metadata && typeof r.metadata === 'object') ? { ...r.metadata } : {};

  // metadata legacy → guests se copia desde partySize si no vino configurado
  if (metadata.guests === undefined && r.partySize != null) metadata.guests = r.partySize;

  return {
    ...r,
    resourceId,
    organizationId,
    metadata,
    // start/end en minutos relativos al servicio (cena cruza medianoche)
    startTime: reservationStartMinutes(r),
    endTime: reservationEndMinutes(r),
  };
}

export const reservationResourceId = (r) => normalizeReservation(r)?.resourceId || null;

// ─── Tiempo de reserva (minutos relativos al servicio) ───────────────────────

export function reservationStartMinutes(r) {
  const time = r?.time;
  if (!time) return null;
  return t2m(time, r?.service);
}

export function reservationEndMinutes(r) {
  const start = reservationStartMinutes(r);
  if (start == null) return null;
  const duration = Number(r?.duration) > 0 ? Number(r.duration) : 0;
  return start + duration;
}

// ─── Superposición de horarios ────────────────────────────────────────────────
// Condición general: newStart < existingEnd && newEnd > existingStart.
// Adaptada al modelo actual (time + duration en minutos por servicio).

/**
 * ¿Dos reservas del MISMO recurso se superponen en el tiempo?
 * Requiere date y service iguales (el lock actual es por turno).
 */
export function reservationsOverlap(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return false;
  if (a.resourceId && b.resourceId && a.resourceId !== b.resourceId) return false;
  if (a.date && b.date && a.date !== b.date) return false;
  if (a.service && b.service && a.service !== b.service) return false;

  const aStart = reservationStartMinutes(a);
  const aEnd = reservationEndMinutes(a);
  const bStart = reservationStartMinutes(b);
  const bEnd = reservationEndMinutes(b);

  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;

  return aStart < bEnd && aEnd > bStart;
}

/**
 * Solapamiento puro por minutos (para cálculos de disponibilidad).
 */
export function minutesOverlap(newStart, newEnd, existingStart, existingEnd) {
  if (newStart == null || newEnd == null || existingStart == null || existingEnd == null) return false;
  return newStart < existingEnd && newEnd > existingStart;
}

/**
 * Devuelve las reservas existentes que chocan con la reserva candidata.
 * @param {Object} candidate - { resourceId, date, service, time, duration }
 * @param {Object[]} existing - lista de reservas (crudas, se normalizan)
 */
export function findConflictingReservations(candidate, existing) {
  const cand = normalizeReservation({
    ...candidate,
    resourceId: candidate.resourceId || candidate.tableId || candidate.mesa_id,
  });
  if (!cand.resourceId || cand.startTime == null) return [];

  return (existing || [])
    .map(normalizeReservation)
    .filter(Boolean)
    .filter(r => r.resourceId === cand.resourceId)
    .filter(r => !r.id || r.id !== cand.id)
    .filter(r => !['cancelado', 'no_show', 'ausente', 'finalizado'].includes(r.estado))
    .filter(r => r.liveState !== 'finalizado')
    .filter(r => reservationsOverlap(cand, r));
}
