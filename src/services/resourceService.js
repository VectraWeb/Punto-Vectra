// resourceService.js — Capa genérica de recursos reservables.
// Compatibilidad: para organizaciones de tipo restaurante (o sin organización)
// se lee/escribe la colección legacy "mesas" (la misma que consume n8n).
// Para otros tipos de negocio se usa "resources". Ambos se normalizan al
// mismo modelo { id, organizationId, name, type, capacity, status, position, metadata }.

import { collection, doc, getDocs, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { buildResources } from '../utils';
import { DEFAULT_ORG_ID, resourceTypeOf } from '../config/businessTypes';
import { normalizeResource, resourceDocData, resourceToMesa } from '../schemas/resourceSchema';

export const mesasCol = () => collection(db, 'mesas');
export const mesaDoc = (id) => doc(db, 'mesas', id);
export const resourcesCol = () => collection(db, 'resources');
export const resourceDoc = (id) => doc(db, 'resources', id);

// Un restaurante (o sin organización) sigue usando "mesas" por compatibilidad
// con el bot de n8n y las reglas de Firestore actuales.
export const isLegacyOrganization = (organization) =>
  !organization || (organization.businessType === 'restaurant' && organization.id === DEFAULT_ORG_ID);

/**
 * Lista de recursos de una organización.
 * @param {Object} [opts] { organization, organizationId, type }
 * @returns {Promise<Object[]>} recursos normalizados
 */
export async function getResources(opts = {}) {
  const { organization, organizationId = opts.organization?.id || DEFAULT_ORG_ID, type } = opts;
  const useLegacy = isLegacyOrganization(organization) || opts.legacy === true;

  const [legacySnap, modernSnap] = await Promise.all([
    getDocs(mesasCol()).catch(() => null),
    useLegacy ? Promise.resolve(null) : getDocs(resourcesCol()).catch(() => null),
  ]);

  const byId = new Map();
  for (const snap of [legacySnap, modernSnap]) {
    if (!snap) continue;
    for (const d of snap.docs) {
      byId.set(d.id, normalizeResource({ id: d.id, ...d.data() }, { organizationId }));
    }
  }

  let list = [...byId.values()];
  if (type) list = list.filter(r => r.type === type);
  return list;
}

/** Suscripción en tiempo real a los recursos (legacy + modernos, merge por id). */
export function subscribeResources(callback, opts = {}) {
  const { organization, organizationId = opts.organization?.id || DEFAULT_ORG_ID, type } = opts;
  const useLegacy = isLegacyOrganization(organization) || opts.legacy === true;

  const emit = (map) => {
    let list = [...map.values()];
    if (type) list = list.filter(r => r.type === type);
    callback(list);
  };

  const byId = new Map();
  const unsubLegacy = onSnapshot(mesasCol(), (snap) => {
    for (const d of snap.docs) byId.set(d.id, normalizeResource({ id: d.id, ...d.data() }, { organizationId }));
    emit(byId);
  }, (e) => console.warn('[resourceService] Error en mesas:', e));

  let unsubModern = null;
  if (!useLegacy) {
    unsubModern = onSnapshot(resourcesCol(), (snap) => {
      for (const d of snap.docs) byId.set(d.id, normalizeResource({ id: d.id, ...d.data() }, { organizationId }));
      emit(byId);
    }, (e) => console.warn('[resourceService] Error en resources:', e));
  }

  return () => {
    unsubLegacy();
    if (unsubModern) unsubModern();
  };
}

export async function getResourceById(id, opts = {}) {
  if (!id) return null;
  const list = await getResources(opts);
  return list.find(r => r.id === id) || null;
}

// ─── Seed / sincronización con la configuración ─────────────────────────────

const legacyDocData = (r) => ({
  capacity: r.capacity,
  name: r.name,
  number: r.number ?? null,
  shape: r.shape,
});

/**
 * Siembra recursos desde la config (mesaTipos) si la colección destino está
 * vacía. Nunca borra ni pisa documentos existentes.
 */
export async function seedResourcesIfNeeded(config, opts = {}) {
  const { organization, resourceType } = opts;
  const useLegacy = isLegacyOrganization(organization);
  const col = useLegacy ? mesasCol() : resourcesCol();
  const snap = await getDocs(col);
  if (!snap.empty) return;

  const items = buildResources(config, {
    type: resourceType || resourceTypeOf(organization),
    prefix: organization?.configuration?.resourceLabel || 'Recurso',
  });

  const batch = writeBatch(db);
  for (const r of items) {
    if (useLegacy) {
      batch.set(mesaDoc(r.id), legacyDocData(r));
    } else {
      batch.set(resourceDoc(r.id), resourceDocData({
        ...r,
        organizationId: opts.organizationId || organization?.id || DEFAULT_ORG_ID,
        status: 'active',
        position: null,
        metadata: {},
      }));
    }
  }
  await batch.commit();
}

/**
 * Sincroniza recursos con la config: borra los que dejaron de existir y
 * crea/actualiza los deseados. Misma semántica que syncMesasWithConfig.
 */
export async function syncResourcesWithConfig(config, opts = {}) {
  const { organization, resourceType } = opts;
  const useLegacy = isLegacyOrganization(organization);
  const col = useLegacy ? mesasCol() : resourcesCol();
  const snap = await getDocs(col);
  const existing = snap.docs.map(d => d.id);

  const desired = buildResources(config, {
    type: resourceType || resourceTypeOf(organization),
    prefix: organization?.configuration?.resourceLabel || 'Recurso',
  });
  const desiredIds = new Set(desired.map(r => r.id));

  const batch = writeBatch(db);
  for (const docId of existing) {
    if (!desiredIds.has(docId)) {
      batch.delete(useLegacy ? mesaDoc(docId) : resourceDoc(docId));
    }
  }
  for (const r of desired) {
    if (useLegacy) {
      batch.set(mesaDoc(r.id), legacyDocData(r));
    } else {
      batch.set(resourceDoc(r.id), resourceDocData({
        ...r,
        organizationId: opts.organizationId || organization?.id || DEFAULT_ORG_ID,
        status: 'active',
        position: null,
        metadata: {},
      }));
    }
  }
  await batch.commit();
}

// ─── Compat helpers (adaptadores para mesasHelpers/useMesas) ────────────────

export const buildMesasList = (config) => buildResources(config, { type: 'table' }).map(resourceToMesa);

export async function seedMesasIfNeeded(config) {
  return seedResourcesIfNeeded(config, { resourceType: 'table', legacy: true });
}

export async function syncMesasWithConfig(config) {
  return syncResourcesWithConfig(config, { resourceType: 'table', legacy: true });
}

export function subscribeMesas(callback) {
  return subscribeResources((resources) => {
    callback(resources.map(resourceToMesa));
  }, { legacy: true, type: 'table' });
}
