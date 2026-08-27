// auditService.js — Auditoría y trazabilidad de acciones importantes.
// Colección auditLogs/{autoId}. No guarda datos sensibles innecesarios.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const auditCol = () => collection(db, 'auditLogs');

/**
 * Registra una acción importante.
 * @param {Object} entry { organizationId, actorId, action, entityType, entityId, previousData?, newData?, metadata? }
 */
export async function writeAuditLog(entry) {
  if (!entry || !entry.action) return null;
  try {
    const docRef = await addDoc(auditCol(), {
      organizationId: entry.organizationId || 'default',
      actorId: entry.actorId || null,
      action: entry.action,
      entityType: entry.entityType || 'generic',
      entityId: entry.entityId || null,
      previousData: entry.previousData || null,
      newData: entry.newData || null,
      metadata: entry.metadata || null,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (e) {
    console.warn('[audit] No se pudo registrar auditoría:', e);
    return null;
  }
}
