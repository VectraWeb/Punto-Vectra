// customerService.js — Clientes del negocio.
// Doc id determinista ({orgId}_{teléfono}): lookup O(1) sin índices y upserts
// idempotentes. Los stats se actualizan por eventos de dominio (reservas).

import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { customerDocId, customerDocData, normalizeCustomer, EMPTY_CUSTOMER_STATS } from '../schemas/customerSchema';
import { emitDomainEvent, DOMAIN_EVENTS } from '../core/events';
import { writeAuditLog } from './auditService';

export const customerDocRef = (organizationId, phone) =>
  doc(db, 'customers', customerDocId(organizationId, phone));

/**
 * Busca o crea un cliente por teléfono. Idempotente: llamadas repetidas no
 * duplican el documento.
 */
export async function getOrCreateCustomer({ organizationId, branchId = null, phone, name = '', email = '' }) {
  if (!phone) return null;
  const ref = customerDocRef(organizationId, phone);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const existing = normalizeCustomer({ id: snap.id, ...snap.data() });
    // El nombre se mejora si llega vacío (no pisamos datos existentes).
    if (!existing.name && name) {
      await setDoc(ref, { name: name.trim() }, { merge: true });
      existing.name = name.trim();
    }
    return existing;
  }
  const data = customerDocData({ organizationId, branchId, phone, name, email }, { created: true });
  await setDoc(ref, data);
  const customer = normalizeCustomer({ id: customerDocId(organizationId, phone), ...data });
  emitDomainEvent(DOMAIN_EVENTS.CUSTOMER_CREATED, { customer });
  return customer;
}

export async function getCustomerById(id) {
  if (!id) return null;
  // El id es {orgId}_{phone}: se resuelve el doc por su id directo.
  const snap = await getDoc(doc(db, 'customers', id)).catch(() => null);
  if (!snap || !snap.exists()) return null;
  return normalizeCustomer({ id: snap.id, ...snap.data() });
}

// Eventos de stats: reserva creada/completada/cancelada/no-show.
const STAT_ACTIONS = {
  'reservation.created': (s) => ({ ...s, reservations: s.reservations + 1 }),
  'reservation.completed': (s) => ({ ...s, completedReservations: s.completedReservations + 1 }),
  'reservation.cancelled': (s) => ({ ...s, cancellations: s.cancellations + 1 }),
  'reservation.no_show': (s) => ({ ...s, noShows: s.noShows + 1 }),
};

/**
 * Actualiza los stats de un cliente de forma atómica (transacción).
 * @param {string} organizationId
 * @param {string} phone
 * @param {string} action - clave de STAT_ACTIONS
 */
export async function updateCustomerStats(organizationId, phone, action) {
  const updater = STAT_ACTIONS[action];
  if (!updater || !phone) return null;
  const ref = customerDocRef(organizationId, phone);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) return;
      const current = { ...EMPTY_CUSTOMER_STATS, ...(snap.data().stats || {}) };
      transaction.update(ref, { stats: updater(current) });
    });
    return true;
  } catch (e) {
    console.warn('[customerService] Error actualizando stats:', e);
    return false;
  }
}

export async function recordAuditForCustomer(actorId, customer) {
  if (!customer) return;
  await writeAuditLog({
    organizationId: customer.organizationId,
    actorId,
    action: 'customer.updated',
    entityType: 'customer',
    entityId: customer.id,
  });
}
