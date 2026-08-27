// catalogSchema.js — Catálogo genérico: productos, servicios, extras y combos.
// duration (minutos) es clave para servicios: el sistema de reservas puede
// usarla para calcular el fin de la reserva automáticamente.

import { DEFAULT_ORG_ID } from '../config/businessTypes';

export const CATALOG_TYPES = ['product', 'service', 'extra', 'combo', 'modifier'];
export const CATALOG_TYPE_LABELS = {
  product: 'Producto',
  service: 'Servicio',
  extra: 'Extra',
  combo: 'Combo',
  modifier: 'Modificador',
};

export function normalizeCatalogItem(doc) {
  const raw = doc?.raw ?? (doc && typeof doc === 'object' ? doc : {});
  return {
    id: doc?.id ?? raw.id ?? '',
    organizationId: raw.organizationId || DEFAULT_ORG_ID,
    branchId: raw.branchId || null,
    type: CATALOG_TYPES.includes(raw.type) ? raw.type : (raw.duration != null ? 'service' : 'product'),
    name: raw.name || '',
    description: raw.description || '',
    categoryId: raw.categoryId || null,
    price: Number(raw.price) || 0,
    duration: raw.duration != null ? Number(raw.duration) : null,
    active: raw.active !== false,
    metadata: (raw.metadata && typeof raw.metadata === 'object') ? raw.metadata : {},
    raw,
  };
}

export function catalogItemDocData(item) {
  return {
    organizationId: item.organizationId || DEFAULT_ORG_ID,
    ...(item.branchId ? { branchId: item.branchId } : {}),
    type: CATALOG_TYPES.includes(item.type) ? item.type : 'product',
    name: item.name || '',
    description: item.description || '',
    categoryId: item.categoryId || null,
    price: Number(item.price) || 0,
    duration: item.duration != null ? Number(item.duration) : null,
    active: item.active !== false,
    metadata: item.metadata || {},
    updatedAt: new Date().toISOString(),
  };
}
