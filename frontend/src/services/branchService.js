// branchService.js — Sucursales de una organización mediante API REST.

import { branchApi } from './api';
import { DEFAULT_ORG_ID } from '../config/businessTypes';
import { normalizeBranch, DEFAULT_BRANCH_ID } from '../schemas/branchSchema';

export async function getBranches(organizationId = DEFAULT_ORG_ID) {
  try {
    const { data } = await branchApi.getByOrganization(organizationId);
    return (data || []).map(b => normalizeBranch(b, organizationId));
  } catch (e) {
    console.warn('[branchService] Error obteniendo sucursales:', e);
    return [];
  }
}

/** Crea la sucursal "main" si la organización no tiene sucursales. */
export async function ensureDefaultBranch(organizationId = DEFAULT_ORG_ID) {
  const branches = await getBranches(organizationId);
  if (branches.length > 0) return branches[0];

  try {
    const { data } = await branchApi.create(organizationId, {
      id: DEFAULT_BRANCH_ID,
      name: 'Sucursal principal',
      timezone: 'America/Argentina/Buenos_Aires',
    });
    return normalizeBranch(data, organizationId);
  } catch (e) {
    console.warn('[branchService] Error creando sucursal default:', e);
    return { id: DEFAULT_BRANCH_ID, organizationId, name: 'Sucursal principal' };
  }
}

export function subscribeBranches(organizationId = DEFAULT_ORG_ID, callback) {
  let cancelled = false;

  const fetchBranches = async () => {
    if (cancelled) return;
    const branches = await getBranches(organizationId);
    if (!cancelled) callback(branches);
  };

  fetchBranches();

  const interval = setInterval(fetchBranches, 30000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}

export async function createBranch(organizationId, branch) {
  const { data } = await branchApi.create(organizationId, branch);
  return { id: data.id, organizationId, ...branch };
}

export async function deleteBranch(organizationId, branchId) {
  if (branchId === DEFAULT_BRANCH_ID) {
    throw new Error('La sucursal principal no se puede eliminar.');
  }
  await branchApi.delete(organizationId, branchId);
}
