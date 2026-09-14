// reservationService.js — Capa genérica de reservas mediante API REST.

import { reservationApi } from './api';
import { DEFAULT_ORG_ID } from '../config/businessTypes';
import { domainError, ERROR_CODES } from '../core/errors';

/**
 * Crea o actualiza una reserva.
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

  // Si tiene id, es una edición → PUT
  if (cleanData.id) {
    try {
      const { data: result } = await reservationApi.update(cleanData.id, {
        ...cleanData,
        date,
        organizationId,
        branchId,
        resourceLabel,
        resourceName,
      });
      return { id: result.id, status: result.status, resourceId: result.resourceId };
    } catch (error) {
      if (error.response?.data?.code) {
        throw domainError(error.response.data.code, error.response.data.error);
      }
      throw error;
    }
  }

  const id = `r${Date.now()}`;

  try {
    const { data: result } = await reservationApi.create({
      ...cleanData,
      id,
      date,
      organizationId,
      branchId,
      resourceLabel,
      resourceName,
    });

    return { id: result.id, status: result.status, resourceId: result.resourceId };
  } catch (error) {
    if (error.response?.data?.code) {
      throw domainError(error.response.data.code, error.response.data.error);
    }
    throw error;
  }
}

/**
 * Transición de estado validada.
 */
export async function updateReservationStatus(reservation, nextStatus, opts = {}) {
  const id = reservation.id;
  if (!id) throw domainError(ERROR_CODES.VALIDATION_ERROR, 'Reserva sin id.');

  await reservationApi.updateStatus(id, nextStatus);

  return nextStatus;
}

/**
 * Cancela/elimina una reserva.
 */
export async function cancelReservation(resData, date) {
  await reservationApi.cancel(resData.id);
}

/**
 * Rechaza una reserva.
 */
export async function rejectReservation(resData, motivo, date) {
  await reservationApi.cancel(resData.id, motivo);
}
