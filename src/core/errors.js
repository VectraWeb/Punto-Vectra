// core/errors.js — Errores de dominio centralizados.
// Los errores técnicos (Firebase, red) nunca llegan al usuario: se traducen
// a códigos de dominio y mensajes comprensibles.

export const ERROR_CODES = {
  RESOURCE_NOT_AVAILABLE: 'RESOURCE_NOT_AVAILABLE',
  RESERVATION_CONFLICT: 'RESERVATION_CONFLICT',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  UNAUTHORIZED_ACTION: 'UNAUTHORIZED_ACTION',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RESOURCE_BLOCKED: 'RESOURCE_BLOCKED',
  BRANCH_NOT_FOUND: 'BRANCH_NOT_FOUND',
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
};

export function domainError(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

export const USER_MESSAGES = {
  [ERROR_CODES.RESOURCE_NOT_AVAILABLE]:
    '⚠️ Este recurso acaba de ser reservado por otro cliente. Por favor seleccioná otra opción disponible.',
  [ERROR_CODES.RESERVATION_CONFLICT]:
    '⚠️ Ya existe una reserva que se superpone con ese horario. Probá otro horario.',
  [ERROR_CODES.INVALID_STATUS_TRANSITION]:
    'Ese cambio de estado no está permitido para la reserva actual.',
  [ERROR_CODES.UNAUTHORIZED_ACTION]:
    'No tenés permisos para realizar esa acción.',
  [ERROR_CODES.VALIDATION_ERROR]:
    'Revisá los datos ingresados.',
  [ERROR_CODES.RESOURCE_BLOCKED]:
    '⚠️ El horario seleccionado acaba de dejar de estar disponible. Por favor seleccioná otro horario.',
  [ERROR_CODES.BRANCH_NOT_FOUND]: 'No se encontró la sucursal.',
  [ERROR_CODES.CUSTOMER_NOT_FOUND]: 'No se encontró el cliente.',
  [ERROR_CODES.ORDER_NOT_FOUND]: 'No se encontró el pedido.',
  [ERROR_CODES.PAYMENT_ERROR]: 'No se pudo procesar el pago.',
};

// Traduce un error (de dominio o técnico) a un mensaje apto para el usuario.
export function toUserMessage(err, fallback = 'Ocurrió un error. Intentá de nuevo.') {
  if (!err) return fallback;
  if (err.code && USER_MESSAGES[err.code]) return USER_MESSAGES[err.code];
  if (err.code === 'permission-denied' || err.code === 'PERMISSION_DENIED') {
    return USER_MESSAGES[ERROR_CODES.UNAUTHORIZED_ACTION];
  }
  return fallback;
}
