// reservationService.js — Capa genérica de reservas.
// Preserva el mecanismo atómico existente: el documento de lock
// mesasReservadas/{resourceId}_{date}_{service} decide quién gana. La PRIMERA
// operación que lo registra obtiene el recurso; las siguientes reciben error.
// Además: pre-chequeo de superposición, cliente vinculado, sucursal, estados
// con máquina de transiciones, eventos de dominio, auditoría e idempotencia.

import { doc, deleteDoc, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { DEFAULT_ORG_ID } from '../config/businessTypes';
import { findConflictingReservations } from '../schemas/reservationSchema';
import { domainError, ERROR_CODES } from '../core/errors';
import { emitDomainEvent, DOMAIN_EVENTS } from '../core/events';
import {
  reservationStatusOf, assertValidTransition, eventForStatus, STATUS_TO_LEGACY,
} from './reservationStates';
import { getOrCreateCustomer, updateCustomerStats } from './customerService';
import { writeAuditLog } from './auditService';
import { sendNotification } from './notificationService';

const resDocRef = (id) => doc(db, 'reservations', id);

// Lock anti doble-booking (misma ruta que usa el bot de n8n: mesasReservadas).
export const resourceLockRef = (resourceId, date, service) =>
  doc(db, 'mesasReservadas', `${resourceId}_${date}_${service}`);

export function reservationUnavailableError(resourceLabel = 'Mesa') {
  return domainError(ERROR_CODES.RESOURCE_NOT_AVAILABLE, 'Ese recurso acaba de ser reservado por otro usuario.', { resourceLabel });
}

export function timeConflictError(conflicts, resourceLabel = 'Mesa', alternatives = []) {
  return domainError(ERROR_CODES.RESERVATION_CONFLICT, 'Ya existe una reserva que se superpone en ese horario.', {
    conflicts, resourceLabel, alternatives,
  });
}

// Datos de reserva que se escriben en Firestore: estructura legacy intacta
// + campos genéricos (organizationId, resourceId, metadata, branchId, etc).
export function reservationDocData(data, { id, date, resourceId, resourceName, resourceLabel = 'Mesa', organizationId = DEFAULT_ORG_ID, branchId = 'main', customerId = null, status = 'pending' }) {
  const payload = {
    ...data,
    id,
    date,
    organizationId,
    branchId,
    customerId,
    resourceId: resourceId || null,
    mesa_id: resourceId || null,
    mesa: resourceId ? (resourceName ? `${resourceLabel} ${resourceName}` : resourceId) : null,
    estado: STATUS_TO_LEGACY[status] || 'pendiente',
    status,
    liveState: data.liveState || null,
    updatedAt: serverTimestamp(),
    createdAt: data.createdAt || serverTimestamp(),
  };
  if (data.metadata && typeof data.metadata === 'object') payload.metadata = data.metadata;
  return payload;
}

/**
 * Crea o actualiza una reserva de forma atómica (idempotente por id).
 *
 * Compatibilidad 1:1 con el saveRes original de StaffDashboard:
 * - `_oldMesaRef`, `_prevResId`, `_prevMesaRef` son claves de transición.
 * - El lock mesasReservadas es la fuente de verdad contra reservas simultáneas.
 *
 * @param {Object} params
 * @param {Object} params.data - campos de la reserva (+ claves _legacy de transición)
 * @param {string} params.date - YYYY-MM-DD
 * @param {string} [params.resourceLabel] - label del recurso (default "Mesa")
 * @param {string} [params.resourceName] - número/nombre visible del recurso
 * @param {string} [params.organizationId]
 * @param {string} [params.branchId] - sucursal (default "main")
 * @param {string} [params.idempotencyKey] - si llega dos veces, no duplica
 * @param {Object[]} [params.existingReservations] - reservas en vivo para pre-chequeo
 * @param {boolean} [params.checkOverlap=true]
 */
export async function createReservation({
  data,
  date,
  resourceLabel = 'Mesa',
  resourceName = null,
  organizationId = DEFAULT_ORG_ID,
  branchId = 'main',
  idempotencyKey = null,
  existingReservations = [],
  checkOverlap = true,
}) {
  const { _oldMesaRef, _prevResId, _prevMesaRef, ...cleanData } = data;
  const id = data.id || (idempotencyKey ? `r${idempotencyKey}` : `r${Date.now()}`);
  const tableId = cleanData.tableId || cleanData.resourceId || null;
  const finalBranchId = cleanData.branchId || branchId || 'main';

  // ── Cliente: se resuelve por teléfono (idempotente) ─────────────────────
  const phone = cleanData.phone || cleanData.customerPhone || '';
  let customerId = cleanData.customerId || null;
  if (!customerId && phone) {
    const customer = await getOrCreateCustomer({
      organizationId,
      branchId: finalBranchId,
      phone,
      name: cleanData.customerName || '',
    }).catch(() => null);
    if (customer) customerId = customer.id;
  }

  if (!tableId) {
    // Sin recurso: reserva pendiente (igual que hoy). Se libera el lock viejo
    // si se está quitando el recurso de una reserva existente.
    if (_oldMesaRef) await deleteDoc(_oldMesaRef).catch(() => {});
    if (_prevMesaRef) await deleteDoc(_prevMesaRef).catch(() => {});
    await setDoc(resDocRef(id), reservationDocData(cleanData, {
      id, date, resourceId: null, resourceName: null, resourceLabel,
      organizationId, branchId: finalBranchId, customerId, status: 'pending',
    }));
    emitDomainEvent(DOMAIN_EVENTS.RESERVATION_CREATED, { id, organizationId, branchId: finalBranchId, customerId, status: 'pending' });
    await writeAuditLog({
      organizationId, actorId: auth.currentUser?.uid || null,
      action: 'reservation.created', entityType: 'reservation', entityId: id,
      newData: { status: 'pending', resourceId: null },
    });
    updateCustomerStats(organizationId, phone, 'reservation.created');
    return { id, status: 'pending' };
  }

  // ── Pre-chequeo de superposición (UX): el lock sigue siendo la fuente ────
  if (checkOverlap) {
    const candidate = {
      resourceId: tableId,
      date,
      service: cleanData.service,
      time: cleanData.time,
      duration: cleanData.duration,
    };
    const conflicts = findConflictingReservations(candidate, existingReservations || [])
      .filter(c => c.id !== id && c.id !== _prevResId);
    if (conflicts.length > 0) {
      throw timeConflictError(conflicts, resourceLabel);
    }
  }

  const lockRef = resourceLockRef(tableId, date, cleanData.service);

  await runTransaction(db, async (transaction) => {
    const lockSnap = await transaction.get(lockRef);

    if (_prevResId) {
      transaction.delete(resDocRef(_prevResId));
      if (_prevMesaRef) transaction.delete(_prevMesaRef);
    }

    if (lockSnap.exists()) {
      const lockData = lockSnap.data();
      if (lockData.reservationId !== id && lockData.reservationId !== _prevResId) {
        throw reservationUnavailableError(resourceLabel);
      }
    }

    if (_oldMesaRef) transaction.delete(_oldMesaRef);

    transaction.set(lockRef, {
      occupied: true,
      reservationId: id,
      time: cleanData.time,
      partySize: cleanData.partySize,
    });

    transaction.set(resDocRef(id), reservationDocData(cleanData, {
      id, date, resourceId: tableId, resourceName, resourceLabel,
      organizationId, branchId: finalBranchId, customerId, status: 'confirmed',
    }));
  });

  emitDomainEvent(DOMAIN_EVENTS.RESERVATION_CONFIRMED, { id, organizationId, branchId: finalBranchId, customerId, resourceId: tableId });
  await writeAuditLog({
    organizationId, actorId: auth.currentUser?.uid || null,
    action: 'reservation.confirmed', entityType: 'reservation', entityId: id,
    newData: { status: 'confirmed', resourceId: tableId },
  });
  updateCustomerStats(organizationId, phone, 'reservation.created');
  sendNotification({ event: 'reservation.confirmed', data: { id, organizationId } });

  return { id, status: 'confirmed', resourceId: tableId };
}

/**
 * Transición de estado validada por la máquina de estados.
 * Estados: pending → confirmed → checked_in → in_progress → completed,
 * terminales: cancelled / no_show / expired.
 */
export async function updateReservationStatus(reservation, nextStatus, opts = {}) {
  const id = reservation.id;
  if (!id) throw domainError(ERROR_CODES.VALIDATION_ERROR, 'Reserva sin id.');

  const current = reservationStatusOf(reservation);
  assertValidTransition(current, nextStatus);
  const date = opts.date || reservation.date;
  const tableId = reservation.tableId || reservation.resourceId;

  await runTransaction(db, async (transaction) => {
    const releases = ['cancelled', 'no_show', 'expired'];
    if (releases.includes(nextStatus) && tableId && reservation.service) {
      const lockRef = resourceLockRef(tableId, date, reservation.service);
      const lockSnap = await transaction.get(lockRef);
      if (lockSnap.exists() && lockSnap.data().reservationId === id) {
        transaction.delete(lockRef);
      }
    }
    transaction.update(resDocRef(id), {
      status: nextStatus,
      estado: STATUS_TO_LEGACY[nextStatus] || 'pendiente',
      updatedAt: serverTimestamp(),
    });
  });

  const event = eventForStatus(nextStatus);
  if (event) emitDomainEvent(event, { id, reservation: { ...reservation, status: nextStatus } });

  await writeAuditLog({
    organizationId: reservation.organizationId || DEFAULT_ORG_ID,
    actorId: opts.actorId || auth.currentUser?.uid || null,
    action: `reservation.${nextStatus}`,
    entityType: 'reservation',
    entityId: id,
    previousData: { status: current },
    newData: { status: nextStatus },
  });

  const phone = reservation.phone || reservation.customerPhone || '';
  const statAction = nextStatus === 'cancelled'
    ? 'reservation.cancelled'
    : nextStatus === 'no_show'
      ? 'reservation.no_show'
      : nextStatus === 'completed'
        ? 'reservation.completed'
        : null;
  if (statAction) updateCustomerStats(reservation.organizationId || DEFAULT_ORG_ID, phone, statAction);

  if (nextStatus === 'cancelled') {
    sendNotification({ event: 'reservation.cancelled', data: { id, organizationId: reservation.organizationId || DEFAULT_ORG_ID } });
  }

  return nextStatus;
}

/**
 * Cancela/elimina una reserva liberando el lock SOLO si sigue siendo suyo.
 * (Misma semántica que deleteRes original.)
 */
export async function cancelReservation(resData, date) {
  await runTransaction(db, async (transaction) => {
    const tableId = resData.tableId || resData.resourceId;
    if (tableId && resData.service) {
      const lockRef = resourceLockRef(tableId, date, resData.service);
      const lockSnap = await transaction.get(lockRef);
      if (lockSnap.exists() && lockSnap.data().reservationId === resData.id) {
        transaction.delete(lockRef);
      }
    }
    transaction.delete(resDocRef(resData.id));
  });
  emitDomainEvent(DOMAIN_EVENTS.RESERVATION_CANCELLED, { id: resData.id });
}

/**
 * Rechaza una reserva (estado cancelado + motivo), liberando el lock si era suyo.
 */
export async function rejectReservation(resData, motivo, date) {
  await runTransaction(db, async (transaction) => {
    const tableId = resData.tableId || resData.resourceId;
    if (tableId && resData.service) {
      const lockRef = resourceLockRef(tableId, date, resData.service);
      const lockSnap = await transaction.get(lockRef);
      if (lockSnap.exists() && lockSnap.data().reservationId === resData.id) {
        transaction.delete(lockRef);
      }
    }
    transaction.update(resDocRef(resData.id), {
      estado: 'cancelado',
      status: 'cancelled',
      rechazoMotivo: (motivo || '').trim(),
      updatedAt: serverTimestamp(),
    });
  });
  emitDomainEvent(DOMAIN_EVENTS.RESERVATION_CANCELLED, { id: resData.id });
}
