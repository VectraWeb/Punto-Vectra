// catalogService.js — Catálogo genérico mediante API REST.

import { catalogApi } from './api';
import { DEFAULT_ORG_ID } from '../config/businessTypes';
import { normalizeCatalogItem } from '../schemas/catalogSchema';

export async function getCatalog(opts = {}) {
  const { organizationId = DEFAULT_ORG_ID, type = null, activeOnly = false } = opts;

  try {
    const { data } = await catalogApi.getByOrganization(organizationId, type, activeOnly);
    return (data || []).map(i => normalizeCatalogItem(i));
  } catch (e) {
    console.warn('[catalogService] Error obteniendo catálogo:', e);
    return [];
  }
}

export function subscribeCatalog(callback, opts = {}) {
  let cancelled = false;

  const fetchCatalog = async () => {
    if (cancelled) return;
    const items = await getCatalog(opts);
    if (!cancelled) callback(items);
  };

  fetchCatalog();

  const interval = setInterval(fetchCatalog, 30000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}

export async function addCatalogItem(item) {
  const { data } = await catalogApi.create(item.organizationId || DEFAULT_ORG_ID, item);
  return data.id;
}

export async function updateCatalogItem(id, patch) {
  await catalogApi.update(id, patch);
}

export async function deleteCatalogItem(id) {
  await catalogApi.delete(id);
}

/**
 * Duración total (minutos) de una lista de servicios del catálogo.
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
