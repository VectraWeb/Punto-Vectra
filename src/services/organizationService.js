// organizationService.js — Acceso a organizations/{id} con fallback legacy.
// Si no existe organizations/{id}, se usa la configuración clásica
// config/restaurant como organización "default" (restaurante).

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_ORG_ID, DEFAULT_ORGANIZATION } from '../config/businessTypes';
import { normalizeOrganization, organizationDocData } from '../schemas/organizationSchema';

export const orgDocRef = (id = DEFAULT_ORG_ID) => doc(db, 'organizations', id);
const legacyCfgRef = () => doc(db, 'config', 'restaurant');

/**
 * Lee una organización; si no existe devuelve la default (idempotente, no
 * crea nada en Firestore salvo que se pida explicitamente).
 */
export async function getOrganization(id = DEFAULT_ORG_ID) {
  try {
    const snap = await getDoc(orgDocRef(id));
    if (snap.exists()) return normalizeOrganization({ id: snap.id, ...snap.data() });
  } catch (e) {
    console.warn('[organizationService] Error leyendo organización:', e);
  }

  // Fallback legacy: config/restaurant puede traer businessType/labels.
  try {
    const legacy = await getDoc(legacyCfgRef());
    if (legacy.exists()) return normalizeOrganization(legacy.data(), id);
  } catch (e) {
    console.warn('[organizationService] Error leyendo config legacy:', e);
  }
  return { ...DEFAULT_ORGANIZATION, id };
}

/** Suscripción en tiempo real con el mismo fallback que getOrganization. */
export function subscribeOrganization(id = DEFAULT_ORG_ID, callback) {
  let legacyUnsub = null;

  const unsubMain = onSnapshot(
    orgDocRef(id),
    (snap) => {
      if (snap.exists()) {
        callback(normalizeOrganization({ id: snap.id, ...snap.data() }));
        return;
      }
      // No existe organizations/{id}: suscribirse a config legacy UNA sola vez.
      if (!legacyUnsub) {
        legacyUnsub = onSnapshot(
          legacyCfgRef(),
          (legacy) => {
            if (legacy.exists()) callback(normalizeOrganization(legacy.data(), id));
            else callback({ ...DEFAULT_ORGANIZATION, id });
          },
          (err) => {
            console.warn('[organizationService] Error suscribiendo config legacy:', err);
            callback({ ...DEFAULT_ORGANIZATION, id });
          }
        );
      }
    },
    (err) => {
      console.warn('[organizationService] Error suscribiendo organización:', err);
      callback({ ...DEFAULT_ORGANIZATION, id });
    }
  );

  return () => {
    unsubMain();
    if (legacyUnsub) legacyUnsub();
  };
}

/**
 * Crea la organización default si no existe (segura e idempotente).
 * No toca datos existentes de config/restaurant, mesas o reservas.
 */
export async function ensureDefaultOrganization() {
  try {
    const snap = await getDoc(orgDocRef());
    if (snap.exists()) return normalizeOrganization({ id: snap.id, ...snap.data() });
    const org = { ...DEFAULT_ORGANIZATION };
    await setDoc(orgDocRef(), { ...organizationDocData(org), createdAt: new Date().toISOString() });
    return org;
  } catch (e) {
    console.warn('[organizationService] Error asegurando organización default:', e);
    return { ...DEFAULT_ORGANIZATION };
  }
}

/** Guarda la organización y espeja los labels en config/restaurant (merge). */
export async function saveOrganization(org) {
  // Preservar el dueño actual si el objeto recibido no lo trae (evita
  // desvincular la organización en ediciones parciales desde la UI).
  let ownerUid = org.ownerUid || null;
  if (!ownerUid && org.id) {
    try {
      const snap = await getDoc(orgDocRef(org.id));
      if (snap.exists() && snap.data().ownerUid) ownerUid = snap.data().ownerUid;
    } catch (e) {
      console.warn('[organizationService] Error leyendo dueño previo:', e);
    }
  }

  const data = organizationDocData({ ...org, ownerUid });
  await setDoc(orgDocRef(org.id), { ...data, createdAt: org.createdAt || new Date().toISOString() });

  // Espejo legacy: solo para la organización default (config/restaurant es
  // global y no debe reflejar datos de otras organizaciones).
  if ((org.id || DEFAULT_ORG_ID) === DEFAULT_ORG_ID) {
    const mirror = {
      businessType: data.businessType,
      organizationName: data.name,
    };
    if (data.configuration?.resourceLabel) mirror.resourceLabel = data.configuration.resourceLabel;
    if (data.configuration?.resourcePlural) mirror.resourcePlural = data.configuration.resourcePlural;
    await setDoc(legacyCfgRef(), mirror, { merge: true });
  }

  return normalizeOrganization({ id: org.id || DEFAULT_ORG_ID, ...data });
}
