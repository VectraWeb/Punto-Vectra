// auditService.js — Auditoría mediante API REST.

import { auditApi } from './api';

/**
 * Registra una acción importante.
 */
export async function writeAuditLog(entry) {
  if (!entry || !entry.action) return null;

  try {
    const { data } = await auditApi.create(entry);
    return data?.id || null;
  } catch (e) {
    console.warn('[audit] No se pudo registrar auditoría:', e);
    return null;
  }
}
