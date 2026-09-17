// organizationService.js — Acceso a organizaciones mediante API REST.

import { organizationApi } from './api';
import { DEFAULT_ORG_ID, DEFAULT_ORGANIZATION } from '../config/businessTypes';

/**
 * Lee una organización; si no existe devuelve la default.
 */
export async function getOrganization(id = DEFAULT_ORG_ID) {
  try {
    const { data } = await organizationApi.getById(id);
    return data;
  } catch (e) {
    console.warn('[organizationService] Error leyendo organización:', e);
    return { ...DEFAULT_ORGANIZATION, id };
  }
}

/**
 * Suscripción en tiempo real — en la nueva arquitectura usamos polling
 * o eventos WebSocket cuando sea necesario. Por ahora, devolvemos una función
 * que el hook puede usar.
 */
export function subscribeOrganization(id = DEFAULT_ORG_ID, callback) {
  let cancelled = false;

  const fetchOrg = async () => {
    if (cancelled) return;
    try {
      const org = await getOrganization(id);
      if (!cancelled) callback(org);
    } catch (e) {
      console.warn('[organizationService] Error en suscripción:', e);
      if (!cancelled) callback({ ...DEFAULT_ORGANIZATION, id });
    }
  };

  fetchOrg();

  // Polling cada 30 segundos para simular suscripción en tiempo real
  const interval = setInterval(fetchOrg, 30000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}

/**
 * Crea la organización default si no existe.
 */
export async function ensureDefaultOrganization() {
  try {
    const org = await getOrganization(DEFAULT_ORG_ID);
    return org;
  } catch (e) {
    console.warn('[organizationService] Error asegurando organización default:', e);
    return { ...DEFAULT_ORGANIZATION };
  }
}

/**
 * Guarda la organización.
 * La vista pública (VistaCliente/ResForm/PedidoForm) lee la org DEFAULT_ORG_ID
 * sin autenticación. Si se guarda otra org (la del staff), reflejamos los
 * días cerrados y los horarios a DEFAULT_ORG_ID para que apliquen
 * para todos los clientes, no solo para los logueados.
 */
export async function saveOrganization(org) {
  const id = org.id || DEFAULT_ORG_ID;
  let saved = org;
  try {
    const { data } = await organizationApi.update(id, org);
    saved = data;
  } catch (e) {
    console.warn('[organizationService] Error guardando organización:', e);
  }

  if (id !== DEFAULT_ORG_ID) {
    try {
      const mirror = {
        name: org.name,
        logo: org.logo || '',
        closedDates: Array.isArray(org.closedDates) ? org.closedDates : [],
      };
      // configuration se fusiona en el backend (merge superficial).
      if (org.configuration?.services) {
        mirror.configuration = { services: org.configuration.services };
      }
      await organizationApi.patch(DEFAULT_ORG_ID, mirror);
    } catch (e) {
      console.warn('[organizationService] Error sincronizando días cerrados:', e);
    }
  }

  return saved;
}
