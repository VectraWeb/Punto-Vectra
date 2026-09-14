// core/events.js — Bus de eventos de dominio desacoplado.
// Acción → Servicio → Firestore → Evento de dominio → (automatización /
// notificación / auditoría / analytics). Los listeners son asíncronos y no
// bloquean la operación principal.

const listeners = new Map();

/**
 * Suscribe un listener a un evento (wildcard '*' recibe todos).
 * @returns {Function} unsubscribe
 */
export function onDomainEvent(eventName, handler) {
  if (typeof handler !== 'function') return () => {};
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(handler);
  return () => {
    const set = listeners.get(eventName);
    if (set) set.delete(handler);
  };
}

/**
 * Emite un evento de dominio. Nunca lanza: los errores de listeners se
 * registran en consola sin afectar al emisor.
 */
export function emitDomainEvent(eventName, payload = {}) {
  const envelope = {
    event: eventName,
    payload,
    at: new Date().toISOString(),
  };
  const targets = new Set([
    ...(listeners.get(eventName) || []),
    ...(listeners.get('*') || []),
  ]);
  for (const handler of targets) {
    try {
      Promise.resolve(handler(envelope)).catch((e) => {
        console.warn(`[events] Listener de "${eventName}" falló:`, e);
      });
    } catch (e) {
      console.warn(`[events] Listener de "${eventName}" falló (sync):`, e);
    }
  }
  return envelope;
}

// Eventos conocidos (tipado suave para mantener consistencia).
export const DOMAIN_EVENTS = {
  RESERVATION_CREATED: 'reservation.created',
  RESERVATION_CONFIRMED: 'reservation.confirmed',
  RESERVATION_CHECKED_IN: 'reservation.checked_in',
  RESERVATION_IN_PROGRESS: 'reservation.in_progress',
  RESERVATION_COMPLETED: 'reservation.completed',
  RESERVATION_CANCELLED: 'reservation.cancelled',
  RESERVATION_NO_SHOW: 'reservation.no_show',
  RESERVATION_EXPIRED: 'reservation.expired',
  CUSTOMER_CREATED: 'customer.created',
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_COMPLETED: 'order.completed',
  PAYMENT_COMPLETED: 'payment.completed',
  ORGANIZATION_UPDATED: 'organization.updated',
  RESOURCE_BLOCKED: 'resource.blocked',
};
