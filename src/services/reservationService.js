// reservationService.js — Capa genérica de reservas.
// Preserva el mecanismo atómico existente: el documento de lock
// mesasReservadas/{resourceId}_{date}_{service} decide quién gana. La PRIMERA
// operación que lo registra obtiene el recurso; las siguientes reciben error.
// Además se pre-verifica superposición de horarios (con los datos en vivo)
// para dar un mensaje claro y ofrecer alternativas, sin reemplazar al lock.

import { doc, deleteDoc, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_ORG_ID } from '../config/businessTypes';
import { findConflictingReservations } from '../schemas/reservationSchema';

const resDocRef = (id) => doc(db, 'reservations', id);

// Lock anti doble-booking (misma ruta que usa el bot de n8n: mesasReservadas).
export const resourceLockRef = (resourceId, date, service) =>
  doc(db, 'mesasReservadas', `${resourceId}_${date}_${service}`);

export function reservationUnavailableError(resourceLabel = 'Mesa') {
  const err = new Error(`Lo sentimos, ese recurso acaba de ser reservado por otro usuario.`);
  err.code = 'RESOURCE_UNAVAILABLE';
  err.resourceLabel = resourceLabel;
  return err;
}

export function timeConflictError(conflicts, resourceLabel = 'Mesa', alternatives = []) {
  const err = new Error(`Ya existe una reserva que se superpone en ese horario.`);
  err.code = 'TIME_CONFLICT';
  err.conflicts = conflicts;
  err.resourceLabel = resourceLabel;
  err.alternatives = alternatives;
  return err;
}

// Datos de reserva que se escriben en Firestore: estructura legacy intacta
// + campos genéricos (organizationId, resourceId, metadata) para el futuro.
export function reservationDocData(data, { id, date, resourceId, resourceName, resourceLabel = 'Mesa', organizationId = DEFAULT_ORG_ID }) {
  const payload = {
    ...data,
    id,
    date,
    organizationId,
    resourceId: resourceId || null,
    mesa_id: resourceId || null,
    mesa: resourceId ? (resourceName ? `${resourceLabel} ${resourceName}` : resourceId) : null,
    estado: resourceId ? 'confirmada' : 'pendiente',
    liveState: data.liveState || null,
    updatedAt: serverTimestamp(),
    createdAt: data.createdAt || serverTimestamp(),
  };
  if (data.metadata && typeof data.metadata === 'object') payload.metadata = data.metadata;
  return payload;
}

/**
 * Crea o actualiza una reserva de forma atómica.
 *
 * Compatibilidad 1:1 con el saveRes original de StaffDashboard:
 * - `_oldMesaRef`, `_prevResId`, `_prevMesaRef` son claves de transición
 *   (reemplazo de reserva en mesa "A limpiar" / edición) y NO se escriben.
 * - El lock mesasReservadas es la fuente de verdad contra reservas simultáneas.
 *
 * @param {Object} params
 * @param {Object} params.data - campos de la reserva (+ claves _legacy de transición)
 * @param {string} params.date - YYYY-MM-DD
 * @param {string} [params.resourceLabel] - label del recurso (default "Mesa")
 * @param {string} [params.resourceName] - número/nombre visible del recurso
 * @param {string} [params.organizationId]
 * @param {Object[]} [params.existingReservations] - reservas en vivo para pre-chequeo de overlap
 * @param {boolean} [params.checkOverlap=true]
 */
export async function createReservation({
  data,
  date,
  resourceLabel = 'Mesa',
  resourceName = null,
  organizationId = DEFAULT_ORG_ID,
  existingReservations = [],
  checkOverlap = true,
}) {
  const id = data.id || `r${Date.now()}`;
  const { _oldMesaRef, _prevResId, _prevMesaRef, ...cleanData } = data;
  const tableId = cleanData.tableId || cleanData.resourceId || null;

  if (!tableId) {
    // Sin recurso: reserva pendiente (igual que hoy). Se libera el lock viejo
    // si se está quitando el recurso de una reserva existente.
    if (_oldMesaRef) await deleteDoc(_oldMesaRef).catch(() => {});
    if (_prevMesaRef) await deleteDoc(_prevMesaRef).catch(() => {});
    await setDoc(resDocRef(id), reservationDocData(cleanData, {
      id, date, resourceId: null, resourceName: null, resourceLabel, organizationId,
    }));
    return { id, status: 'pendiente' };
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
      id, date, resourceId: tableId, resourceName, resourceLabel, organizationId,
    }));
  });

  return { id, status: 'confirmed', resourceId: tableId };
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
      rechazoMotivo: (motivo || '').trim(),
      updatedAt: serverTimestamp(),
    });
  });
}
