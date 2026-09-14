// customerService.js — Clientes del negocio mediante API REST.

import { customerApi } from './api';
import { normalizeCustomer } from '../schemas/customerSchema';

/**
 * Busca o crea un cliente por teléfono.
 */
export async function getOrCreateCustomer({ organizationId, branchId = null, phone, name = '', email = '' }) {
  if (!phone) return null;

  try {
    const { data } = await customerApi.getOrCreate({ organizationId, branchId, phone, name, email });
    return normalizeCustomer(data);
  } catch (e) {
    console.warn('[customerService] Error obteniendo/creando cliente:', e);
    return null;
  }
}

export async function getCustomerById(id) {
  if (!id) return null;

  try {
    const { data } = await customerApi.getById(id);
    return normalizeCustomer(data);
  } catch (e) {
    console.warn('[customerService] Error obteniendo cliente:', e);
    return null;
  }
}

export async function updateCustomerStats(organizationId, phone, action) {
  // Stats are updated server-side in the new architecture
  return true;
}

export async function recordAuditForCustomer(actorId, customer) {
  // Audit is handled server-side
}
