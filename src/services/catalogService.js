// catalogService.js — Catálogo genérico (productos, servicios, extras, combos).
// Colección: catalog/{itemId}. La duración de los servicios alimenta al
// sistema de reservas (duración automática del turno).

import { collection, doc, getDocs, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_ORG_ID } from '../config/businessTypes';
import { normalizeCatalogItem, catalogItemDocData } from '../schemas/catalogSchema';

export const catalogCol = () => collection(db, 'catalog');
export const catalogDocRef = (id) => doc(db, 'catalog', id);

export async function getCatalog(opts = {}) {
  const { organizationId = DEFAULT_ORG_ID, branchId = null, type = null, activeOnly = false } = opts;
  const snap = await getDocs(catalogCol()).catch(() => null);
  if (!snap) return [];
  let list = snap.docs
    .map(d => normalizeCatalogItem({ id: d.id, ...(d.data() || {}) }))
    .filter(i => i.organizationId === organizationId);
  if (branchId) list = list.filter(i => !i.branchId || i.branchId === branchId);
  if (type) list = list.filter(i => i.type === type);
  if (activeOnly) list = list.filter(i => i.active);
  return list;
}

export function subscribeCatalog(callback, opts = {}) {
  const { organizationId = DEFAULT_ORG_ID, branchId = null } = opts;
  return onSnapshot(
    catalogCol(),
    (snap) => {
      let list = snap.docs
        .map(d => normalizeCatalogItem({ id: d.id, ...(d.data() || {}) }))
        .filter(i => i.organizationId === organizationId);
      if (branchId) list = list.filter(i => !i.branchId || i.branchId === branchId);
      callback(list);
    },
    (err) => {
      console.warn('[catalogService] Error suscribiendo catálogo:', err);
      callback([]);
    }
  );
}

export async function addCatalogItem(item) {
  const id = item.id || `cat_${Date.now().toString(36)}`;
  await setDoc(catalogDocRef(id), catalogItemDocData({ ...item, id }));
  return id;
}

export async function updateCatalogItem(id, patch) {
  await setDoc(catalogDocRef(id), { ...patch, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function deleteCatalogItem(id) {
  await deleteDoc(catalogDocRef(id));
}

/**
 * Duración total (minutos) de una lista de servicios del catálogo.
 * @param {Object[]} catalog - items normalizados
 * @param {string[]} serviceIds
 * @returns {number|null} null si no hay duraciones conocidas
 */
export function servicesDuration(catalog, serviceIds) {
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) return null;
  let total = 0;
  let found = false;
  for (const sid of serviceIds) {
    const item = (catalog || []).find(i => i.id === sid);
    if (item && item.duration != null) {
      total += Math.max(0, Number(item.duration));
      found = true;
    }
  }
  return found ? total : null;
}
