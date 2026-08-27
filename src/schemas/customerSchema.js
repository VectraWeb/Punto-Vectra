// customerSchema.js — Clientes del negocio.
// El doc id es determinista: {organizationId}_{telefonoNormalizado}, lo que
// permite lookup O(1) sin índices compuestos y upserts idempotentes.

import { DEFAULT_ORG_ID } from '../config/businessTypes';

export const EMPTY_CUSTOMER_STATS = {
  reservations: 0,
  completedReservations: 0,
  cancellations: 0,
  noShows: 0,
  totalSpent: 0,
};

export function normalizePhoneKey(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

export const customerDocId = (organizationId, phone) =>
  `${organizationId || DEFAULT_ORG_ID}_${normalizePhoneKey(phone)}`;

export function normalizeCustomer(doc) {
  const raw = doc?.raw ?? (doc && typeof doc === 'object' ? doc : {});
  return {
    id: doc?.id ?? raw.id ?? '',
    organizationId: raw.organizationId || DEFAULT_ORG_ID,
    branchId: raw.branchId || null,
    name: raw.name || '',
    phone: raw.phone || '',
    email: raw.email || '',
    contact: (raw.contact && typeof raw.contact === 'object') ? raw.contact : {},
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    notes: raw.notes || '',
    preferences: (raw.preferences && typeof raw.preferences === 'object') ? raw.preferences : {},
    stats: { ...EMPTY_CUSTOMER_STATS, ...(raw.stats || {}) },
    createdAt: raw.createdAt || null,
    raw,
  };
}

export function customerDocData(customer, { created = false } = {}) {
  return {
    organizationId: customer.organizationId,
    ...(customer.branchId ? { branchId: customer.branchId } : {}),
    name: customer.name || '',
    phone: customer.phone || '',
    email: customer.email || '',
    contact: customer.contact || {},
    tags: customer.tags || [],
    notes: customer.notes || '',
    preferences: customer.preferences || {},
    ...(created ? { stats: { ...EMPTY_CUSTOMER_STATS } } : {}),
    ...(created ? { createdAt: new Date().toISOString() } : {}),
    updatedAt: new Date().toISOString(),
  };
}
