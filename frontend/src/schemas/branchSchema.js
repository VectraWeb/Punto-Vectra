// branchSchema.js — Sucursales de una organización.
// Viven como subcolección: organizations/{organizationId}/branches/{branchId}.
// La sucursal "main" es la creada por defecto (compat con datos existentes).

import { DEFAULT_ORG_ID } from '../config/businessTypes';

export const DEFAULT_BRANCH_ID = 'main';

export function normalizeBranch(doc, fallbackOrganizationId = DEFAULT_ORG_ID) {
  const raw = doc?.raw ?? (doc && typeof doc === 'object' ? doc : {});
  return {
    id: doc?.id ?? raw.id ?? DEFAULT_BRANCH_ID,
    organizationId: raw.organizationId || fallbackOrganizationId,
    name: raw.name || 'Sucursal principal',
    address: (raw.address && typeof raw.address === 'object') ? raw.address : {},
    timezone: raw.timezone || 'America/Argentina/Buenos_Aires',
    businessHours: (raw.businessHours && typeof raw.businessHours === 'object') ? raw.businessHours : {},
    settings: (raw.settings && typeof raw.settings === 'object') ? raw.settings : {},
    createdAt: raw.createdAt || null,
    raw,
  };
}

export function branchDocData(branch) {
  return {
    organizationId: branch.organizationId,
    name: branch.name || 'Sucursal principal',
    address: branch.address || {},
    timezone: branch.timezone || 'America/Argentina/Buenos_Aires',
    businessHours: branch.businessHours || {},
    settings: branch.settings || {},
    updatedAt: new Date().toISOString(),
  };
}
