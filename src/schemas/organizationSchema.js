// organizationSchema.js — Normalización del concepto de organización.
// Compatibilidad: si no existe organizations/{id} en Firestore, se resuelve
// una organización "default" equivalente al restaurante actual (config/restaurant).

import { DEFAULT_ORGANIZATION, DEFAULT_ORG_ID, DEFAULT_BUSINESS_TYPE, getBusinessType } from '../config/businessTypes';

/**
 * Normaliza un documento crudo de organización (o un objeto parcial).
 * Nunca lanza: ante datos inválidos devuelve la organización default.
 *
 * @param {Object|null} raw - Doc de Firestore organizations/{id} (o config/restaurant legacy).
 * @param {string} [fallbackId]
 * @returns {Object} { id, name, businessType, logo, configuration, bookingFields, createdAt, raw }
 */
export function normalizeOrganization(raw, fallbackId = DEFAULT_ORG_ID) {
  const base = DEFAULT_ORGANIZATION;
  if (!raw || typeof raw !== 'object') return { ...base, id: fallbackId, raw: null };

  const businessType = raw.businessType || base.businessType;
  const typeCfg = getBusinessType(businessType);

  return {
    id: raw.id || fallbackId,
    name: raw.name || raw.businessName || base.name,
    businessType,
    logo: raw.logo || '',
    ownerUid: raw.ownerUid || null,
    configuration: {
      resourceLabel: raw.resourceLabel || raw.configuration?.resourceLabel,
      resourcePlural: raw.resourcePlural || raw.configuration?.resourcePlural,
      resourceType: raw.resourceType || raw.configuration?.resourceType,
      ...(raw.configuration || {}),
    },
    bookingFields: Array.isArray(raw.bookingFields) && raw.bookingFields.length > 0
      ? raw.bookingFields
      : typeCfg.defaultBookingFields,
    createdAt: raw.createdAt || null,
    raw,
  };
}

export function isDefaultOrganization(org) {
  return !org || !org.id || org.id === DEFAULT_ORG_ID;
}

// Organización mínima válida para escritura (organizations/{id}).
export function organizationDocData(org) {
  return {
    id: org.id || DEFAULT_ORG_ID,
    name: org.name || DEFAULT_ORGANIZATION.name,
    businessType: org.businessType || DEFAULT_BUSINESS_TYPE,
    logo: org.logo || '',
    ownerUid: org.ownerUid || null,
    configuration: org.configuration || {},
    bookingFields: org.bookingFields || [],
    updatedAt: new Date().toISOString(),
  };
}
