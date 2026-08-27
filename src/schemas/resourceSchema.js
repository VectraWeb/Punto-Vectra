// resourceSchema.js — Normalización del concepto de recurso reservable.
// Compatibilidad: un documento viejo de la colección "mesas" ({ capacity, name,
// number, shape }) se interpreta como recurso de tipo "table" sin migrar datos.

import { DEFAULT_ORG_ID } from '../config/businessTypes';

export const RESOURCE_TYPES = ['table', 'court', 'room', 'professional', 'space', 'chair', 'box', 'custom'];

export const RESOURCE_SHAPE_BY_TYPE = {
  table: 'round',
  court: 'rectangular',
  room: 'rectangular',
  professional: 'round',
  space: 'rectangular',
  chair: 'square-sm',
  box: 'square',
  custom: 'rectangular',
};

/**
 * Convierte un documento crudo (mesas/{id} o resources/{id}) en un recurso
 * genérico. Nunca lanza; campos ausentes quedan con defaults seguros.
 *
 * @param {Object} doc - { id, ...data }
 * @param {Object} [opts] - { organizationId }
 * @returns {Object} { id, organizationId, name, type, capacity, status, position, width, height, shape, metadata, raw }
 */
export function normalizeResource(doc, opts = {}) {
  const raw = doc?.raw ?? (doc && typeof doc === 'object' ? doc : {});
  const id = doc?.id ?? raw.id ?? '';
  const organizationId = raw.organizationId || opts.organizationId || DEFAULT_ORG_ID;

  // type: explícito > inferido desde metadata > default según collection legacy
  const type = raw.type || raw.resourceType || (raw.metadata?.resourceType) || 'table';

  // position: {x,y} nuevo, o {x,y} guardado en config/salon-layout (no viene acá)
  let position = null;
  if (raw.position && typeof raw.position === 'object') {
    position = { x: Number(raw.position.x) || 0, y: Number(raw.position.y) || 0 };
  }

  return {
    id,
    organizationId,
    name: raw.name || raw.label || `Recurso ${id}`,
    type,
    capacity: Number(raw.capacity ?? raw.capacidad ?? 0),
    status: raw.status || 'active',
    position,
    width: Number(raw.width) || 0,
    height: Number(raw.height) || 0,
    // shape: mantiene compatibilidad visual con SalonFloor (mesas legacy)
    shape: raw.shape || raw.forma ? (raw.shape || raw.forma) : RESOURCE_SHAPE_BY_TYPE[type] || 'rectangular',
    metadata: (raw.metadata && typeof raw.metadata === 'object') ? { ...raw.metadata } : {},
    // number: legacy de mesas (m1 → 1)
    number: raw.number ?? null,
    raw,
  };
}

// Vista "mesa" para los componentes legacy (SalonFloor, hooks de mozos).
// Un recurso no-table también se puede dibujar: shape por tipo.
export function resourceToMesa(resource) {
  return {
    id: resource.id,
    name: resource.name,
    capacity: resource.capacity,
    shape: resource.shape || RESOURCE_SHAPE_BY_TYPE[resource.type] || 'rectangular',
    number: resource.number ?? null,
    type: resource.type,
  };
}

// Datos para escribir en resources/{id} (o mesas/{id} en modo legacy).
export function resourceDocData(resource, opts = {}) {
  const legacy = opts.legacy === true;
  if (legacy) {
    // Colección "mesas": solo campos que permite firestore.rules actual.
    return {
      capacity: resource.capacity,
      name: resource.name,
      number: resource.number ?? null,
      shape: resource.shape || RESOURCE_SHAPE_BY_TYPE[resource.type] || 'rectangular',
    };
  }
  return {
    organizationId: resource.organizationId || DEFAULT_ORG_ID,
    name: resource.name,
    type: resource.type || 'table',
    capacity: resource.capacity ?? 0,
    status: resource.status || 'active',
    position: resource.position || null,
    width: resource.width || 0,
    height: resource.height || 0,
    shape: resource.shape || RESOURCE_SHAPE_BY_TYPE[resource.type] || 'rectangular',
    metadata: resource.metadata || {},
    updatedAt: new Date().toISOString(),
  };
}
