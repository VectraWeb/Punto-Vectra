// migrations.js — Migraciones seguras, idempotentes y OPT-IN.
// NINGUNA se ejecuta automáticamente: deben invocarse de forma explícita
// (p. ej. desde una Cloud Function o herramienta admin). No borran datos:
// solo agregan campos genéricos (organizationId, resourceId, metadata)
// a documentos legacy sin alterar el resto.

import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_ORG_ID } from '../config/businessTypes';

const resCol = () => collection(db, 'reservations');

/**
 * Agrega organizationId + resourceId (espejo de tableId/mesa_id) a las
 * reservas que no los tienen. Idempotente: no pisa valores existentes.
 * @returns {Promise<number>} cantidad de documentos actualizados
 */
export async function migrateReservationsToGeneric({ organizationId = DEFAULT_ORG_ID } = {}) {
  const snap = await getDocs(resCol());
  let updated = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const resourceId = data.resourceId || data.tableId || data.mesa_id;
    const patch = {};
    let needs = false;

    if (data.organizationId == null) { patch.organizationId = organizationId; needs = true; }
    if (resourceId != null && data.resourceId == null) { patch.resourceId = resourceId; needs = true; }
    if (data.metadata == null) { patch.metadata = {}; needs = true; }

    if (needs) {
      await setDoc(doc(db, 'reservations', d.id), patch, { merge: true });
      updated++;
    }
  }
  return updated;
}

/**
 * Agrega organizationId/type/status/metadata a las mesas legacy.
 * No cambia ids ni campos existentes (sigue todo compatible con n8n).
 * @returns {Promise<number>} documentos actualizados
 */
export async function migrateMesasToResources({ organizationId = DEFAULT_ORG_ID } = {}) {
  const snap = await getDocs(collection(db, 'mesas'));
  let updated = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const patch = {};
    let needs = false;
    if (data.organizationId == null) { patch.organizationId = organizationId; needs = true; }
    if (data.type == null) { patch.type = 'table'; needs = true; }
    if (data.status == null) { patch.status = 'active'; needs = true; }
    if (data.metadata == null) { patch.metadata = {}; needs = true; }
    if (needs) {
      await setDoc(doc(db, 'mesas', d.id), patch, { merge: true });
      updated++;
    }
  }
  return updated;
}
