// resourceService.js — Capa genérica de recursos reservables mediante API REST.

import { resourceApi } from './api';
import { DEFAULT_ORG_ID } from '../config/businessTypes';
import { normalizeResource } from '../schemas/resourceSchema';

/**
 * Lista de recursos de una organización.
 */
export async function getResources(opts = {}) {
  const { organizationId = opts.organization?.id || DEFAULT_ORG_ID, type } = opts;

  try {
    const { data } = await resourceApi.getByOrganization(organizationId, type);
    return (data || []).map(r => normalizeResource(r, { organizationId }));
  } catch (e) {
    console.warn('[resourceService] Error obteniendo recursos:', e);
    return [];
  }
}

/**
 * Suscripción en tiempo real — polling cada 5 segundos + refresco
 * inmediato cuando se crea, actualiza o borra un recurso.
 */
const changeListeners = new Set();
export function onResourcesChanged(fn) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}
function emitResourcesChanged() {
  changeListeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
}

export function subscribeResources(callback, opts = {}) {
  let cancelled = false;

  const fetchResources = async () => {
    if (cancelled) return;
    const resources = await getResources(opts);
    if (!cancelled) callback(resources);
  };

  fetchResources();

  const interval = setInterval(fetchResources, 5000);
  const off = onResourcesChanged(() => { if (!cancelled) fetchResources(); });

  return () => {
    cancelled = true;
    clearInterval(interval);
    off();
  };
}

export async function getResourceById(id, opts = {}) {
  if (!id) return null;
  const list = await getResources(opts);
  return list.find(r => r.id === id) || null;
}

// ─── Seed / sincronización con la configuración ─────────────────────────────

/**
 * Siembra recursos desde la config si la organización no tiene recursos.
 */
export async function seedResourcesIfNeeded(config, opts = {}) {
  const { organization } = opts;
  const organizationId = opts.organizationId || organization?.id || DEFAULT_ORG_ID;
  const resources = await getResources({ organizationId });
  if (resources.length > 0) return;

  const { buildResources } = await import('../utils');
  const { resourceTypeOf } = await import('../config/businessTypes');

  const items = buildResources(config, {
    type: opts.resourceType || resourceTypeOf(organization),
    prefix: organization?.configuration?.resourceLabel || 'Recurso',
  });

  try {
    await resourceApi.seed(organizationId, items.map(r => ({
      ...r,
      organizationId,
      status: 'active',
    })));
  } catch (e) {
    console.warn('[resourceService] Error sembrando recursos:', e);
  }
}

/**
 * Sincroniza recursos con la config.
 */
export async function syncResourcesWithConfig(config, opts = {}) {
  await seedResourcesIfNeeded(config, opts);
}

// ─── CRUD individual ───────────────────────────────────────────────────────

export async function addResource(resource, opts = {}) {
  const organizationId = opts.organizationId || opts.organization?.id || DEFAULT_ORG_ID;
  const { data } = await resourceApi.create(organizationId, resource);
  emitResourcesChanged();
  return data.id;
}

export async function updateResource(id, patch, opts = {}) {
  const organizationId = opts.organizationId || opts.organization?.id || DEFAULT_ORG_ID;
  await resourceApi.update(organizationId, id, patch);
  emitResourcesChanged();
}

export async function deleteResource(id, opts = {}) {
  const organizationId = opts.organizationId || opts.organization?.id || DEFAULT_ORG_ID;
  await resourceApi.delete(organizationId, id);
  emitResourcesChanged();
}

/**
 * Siembra el set inicial de recursos del rubro.
 */
export async function seedDefaultResourcesForOrg(organization) {
  await seedResourcesIfNeeded(null, {
    organization,
    resourceType: organization?.configuration?.resourceType || 'table',
  });
}

/**
 * Siembra un set de recursos personalizados.
 */
export async function seedResourcesCustom(organizationId, resources, organization) {
  try {
    await resourceApi.seed(organizationId, resources);
  } catch (e) {
    console.warn('[resourceService] Error sembrando recursos custom:', e);
  }
}

// ─── Compat helpers ────────────────────────────────────────────────────────

export const buildMesasList = (config) => {
  const { buildResources } = require('../utils');
  return buildResources(config, { type: 'table' });
};

export async function seedMesasIfNeeded(config) {
  return seedResourcesIfNeeded(config, { resourceType: 'table' });
}

export async function syncMesasWithConfig(config) {
  return syncResourcesWithConfig(config, { resourceType: 'table' });
}

export function subscribeMesas(callback) {
  return subscribeResources((resources) => {
    callback(resources);
  }, { type: 'table' });
}
