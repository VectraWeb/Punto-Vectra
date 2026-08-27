// orderService.js — Pedidos genéricos (compat con la colección legacy "pedidos").
// Un pedido puede existir: asociado a una reserva, a un cliente, a un recurso
// o de forma independiente. El staff de restaurante sigue usando PedidosPanel.

import { doc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_ORG_ID } from '../config/businessTypes';
import { domainError, ERROR_CODES } from '../core/errors';
import { emitDomainEvent, DOMAIN_EVENTS } from '../core/events';
import {
  normalizeOrder, orderStatusOf, legacyStatusOf, canTransitionOrder, normalizeOrderItem,
} from '../schemas/orderSchema';
import { writeAuditLog } from './auditService';
import { sendNotification } from './notificationService';

const pedidosDocRef = (id) => doc(db, 'pedidos', id);

/**
 * Crea un pedido genérico. Escribe en la colección "pedidos" (legacy + campos
 * nuevos) para no romper PedidosPanel ni n8n.
 * @param {Object} order { organizationId, branchId, customerId, customerName, phone,
 *   reservationId, resourceId, items, totals, notes, date, service, source, metadata, id? }
 */
export async function createOrder(order) {
  const id = order.id || `p${Date.now()}`;
  const items = (order.items || []).map((it, i) => normalizeOrderItem(it, i)).filter(Boolean);
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const status = order.status || 'created';

  const payload = {
    id,
    organizationId: order.organizationId || DEFAULT_ORG_ID,
    branchId: order.branchId || 'main',
    customerId: order.customerId || null,
    customerName: order.customerName || '',
    customerPhone: order.phone || '',
    phone: order.phone || '',
    reservationId: order.reservationId || null,
    resourceId: order.resourceId || null,
    items,
    status,
    totals: order.totals || { subtotal, discounts: 0, taxes: 0, total: subtotal },
    modalidad: order.modalidad || null,
    direccion: order.direccion || '',
    notes: order.notes || '',
    tipo: 'pedido',
    date: order.date || '',
    service: order.service || '',
    source: order.source || 'web',
    metadata: order.metadata || {},
    // Compat legacy: el panel de pedidos lee estos campos.
    pedidoEstado: legacyStatusOf(status),
    estado: 'pendiente',
    updatedAt: serverTimestamp(),
    createdAt: order.createdAt || serverTimestamp(),
  };

  await setDoc(pedidosDocRef(id), payload);

  emitDomainEvent(DOMAIN_EVENTS.ORDER_CREATED, { order: normalizeOrder({ id, ...payload }) });
  await writeAuditLog({
    organizationId: payload.organizationId,
    actorId: order.actorId || null,
    action: 'order.created',
    entityType: 'order',
    entityId: id,
    newData: { status, itemsCount: items.length, total: payload.totals.total },
  });
  sendNotification({ event: 'order.created', data: { id, organizationId: payload.organizationId, total: payload.totals.total } });

  return { id, order: normalizeOrder({ id, ...payload }) };
}

/**
 * Cambia el estado de un pedido validando la máquina de estados.
 * Actualiza también pedidoEstado (compat con PedidosPanel/n8n).
 */
export async function updateOrderStatus(orderId, nextStatus, opts = {}) {
  const ref = pedidosDocRef(orderId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      throw domainError(ERROR_CODES.ORDER_NOT_FOUND, 'No se encontró el pedido.');
    }
    const current = orderStatusOf(snap.data());
    if (!canTransitionOrder(current, nextStatus)) {
      throw domainError(ERROR_CODES.INVALID_STATUS_TRANSITION, `Transición inválida: ${current} → ${nextStatus}`);
    }
    transaction.update(ref, {
      status: nextStatus,
      pedidoEstado: legacyStatusOf(nextStatus),
      updatedAt: serverTimestamp(),
    });
  });

  const event = nextStatus === 'completed' ? DOMAIN_EVENTS.ORDER_COMPLETED : DOMAIN_EVENTS.ORDER_UPDATED;
  emitDomainEvent(event, { orderId, nextStatus });
  await writeAuditLog({
    organizationId: opts.organizationId || DEFAULT_ORG_ID,
    actorId: opts.actorId || null,
    action: `order.${nextStatus}`,
    entityType: 'order',
    entityId: orderId,
  });
  return nextStatus;
}
