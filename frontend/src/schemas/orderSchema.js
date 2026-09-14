// orderSchema.js — Pedido genérico + máquina de estados.
// Compatibilidad: los docs legacy de la colección "pedidos" (restaurante)
// se normalizan a la vista genérica sin migración.

import { DEFAULT_ORG_ID } from '../config/businessTypes';

export const ORDER_STATUSES = ['created', 'confirmed', 'in_preparation', 'ready', 'completed', 'cancelled'];
export const ORDER_STATUS_LABELS = {
  created: 'Creado',
  confirmed: 'Confirmado',
  in_preparation: 'En preparación',
  ready: 'Listo',
  completed: 'Entregado / Finalizado',
  cancelled: 'Cancelado',
};

// Mapeo con los estados legacy de la colección "pedidos".
const LEGACY_TO_STATUS = {
  pendiente: 'created',
  confirmado: 'confirmed',
  en_preparacion: 'in_preparation',
  listo: 'ready',
  entregado: 'completed',
  finalizado: 'completed',
  cancelado: 'cancelled',
};
const STATUS_TO_LEGACY = {
  created: 'pendiente',
  confirmed: 'confirmado',
  in_preparation: 'en_preparacion',
  ready: 'listo',
  completed: 'entregado',
  cancelled: 'cancelado',
};

export const ORDER_TRANSITIONS = {
  created: ['confirmed', 'cancelled'],
  confirmed: ['in_preparation', 'cancelled'],
  in_preparation: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function orderStatusOf(order) {
  if (order?.status && ORDER_STATUSES.includes(order.status)) return order.status;
  return LEGACY_TO_STATUS[order?.pedidoEstado] || LEGACY_TO_STATUS[order?.estado] || 'created';
}

export function legacyStatusOf(status) {
  return STATUS_TO_LEGACY[status] || 'pendiente';
}

export function canTransitionOrder(from, to) {
  return (ORDER_TRANSITIONS[from] || []).includes(to);
}

// Normaliza un item de pedido (estructura robusta para todos los rubros).
export function normalizeOrderItem(item, index = 0) {
  if (!item) return null;
  const quantity = Number(item.quantity) || 1;
  const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
  return {
    id: item.id || `it_${index}_${Date.now()}`,
    productId: item.productId || null,
    type: item.type || 'product',
    name: item.name || item.productName || '',
    quantity,
    unitPrice,
    subtotal: Number(item.subtotal ?? quantity * unitPrice),
    modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
    notes: item.notes || '',
    status: item.status || 'pending',
  };
}

export function normalizeOrder(doc) {
  const raw = doc?.raw ?? (doc && typeof doc === 'object' ? doc : {});
  const items = (Array.isArray(raw.items) ? raw.items : []).map(normalizeOrderItem).filter(Boolean);
  const computedSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
  return {
    id: doc?.id ?? raw.id ?? '',
    organizationId: raw.organizationId || DEFAULT_ORG_ID,
    branchId: raw.branchId || 'main',
    customerId: raw.customerId || null,
    customerName: raw.customerName || '',
    phone: raw.phone || raw.customerPhone || '',
    reservationId: raw.reservationId || null,
    resourceId: raw.resourceId || null,
    items,
    status: orderStatusOf(raw),
    // totals: si vienen explícitos se respetan; si no, se calculan.
    totals: {
      subtotal: raw.totals?.subtotal ?? computedSubtotal,
      discounts: raw.totals?.discounts ?? 0,
      taxes: raw.totals?.taxes ?? 0,
      total: raw.totals?.total ?? computedSubtotal,
    },
    modalidad: raw.modalidad || null,
    direccion: raw.direccion || '',
    notes: raw.notes || '',
    date: raw.date || '',
    service: raw.service || '',
    source: raw.source || 'web',
    metadata: (raw.metadata && typeof raw.metadata === 'object') ? raw.metadata : {},
    createdAt: raw.createdAt || null,
    raw,
  };
}
