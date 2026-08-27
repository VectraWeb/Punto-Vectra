// authService.js — Autenticación Firebase y cuentas por organización.
// Cada empresa tiene su organización (organizations/{id}) y cada usuario su
// vínculo (users/{uid} → organizationId). El primer registro puede reclamar
// la organización "default" (datos del restaurante actual) si está libre.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  signInAnonymously as fbSignInAnonymously,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { DEFAULT_ORG_ID, getBusinessType, bookingFieldsOf } from '../config/businessTypes';
import { normalizeOrganization } from '../schemas/organizationSchema';
import { saveOrganization } from './organizationService';
import { seedResourcesCustom } from './resourceService';

export const userDocRef = (uid) => doc(db, 'users', uid);
export const orgDocRef = (id = DEFAULT_ORG_ID) => doc(db, 'organizations', id);

// ─── Sesión anónima (vista pública de clientes) ─────────────────────────────
// Permite que el formulario público pueda escribir (las reglas exigen auth).
export async function signInAnonymous() {
  if (auth.currentUser) return auth.currentUser;
  const { user } = await fbSignInAnonymously(auth);
  return user;
}

// ─── Login / Logout ──────────────────────────────────────────────────────────

export async function signInWithEmail(email, password) {
  // Si hay sesión anónima activa, cerrarla antes (Firestore no permite
  // convertir anónimo → email directamente).
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    await fbSignOut(auth);
  }
  const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
  return user;
}

export async function signOutUser() {
  await fbSignOut(auth);
}

// ─── Registro de negocio ─────────────────────────────────────────────────────

/**
 * Crea la cuenta + organización + recursos iniciales + vínculo users/{uid}.
 * @param {Object} params { email, password, businessType, name, resourceLabel, resourcePlural, resourceCount, capacity }
 */
export async function registerBusiness({
  email,
  password,
  businessType = 'restaurant',
  name,
  resourceLabel,
  resourcePlural,
  resourceCount = 3,
  capacity = 1,
}) {
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    await fbSignOut(auth);
  }
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return setupOrganizationForUser({
    uid: user.uid,
    email: email.trim(),
    businessType,
    name,
    resourceLabel,
    resourcePlural,
    resourceCount,
    capacity,
  });
}

/**
 * Configura organización + recursos + vínculo para un usuario YA autenticado
 * (sin crear cuenta nueva). Usado cuando la cuenta existe pero no tiene negocio.
 */
export async function setupOrganizationForUser({
  uid,
  email,
  businessType = 'restaurant',
  name,
  resourceLabel,
  resourcePlural,
  resourceCount = 3,
  capacity = 1,
}) {
  const typeCfg = getBusinessType(businessType);

  const organizationId = `org_${Date.now().toString(36)}`;
  const organization = {
    id: organizationId,
    name: name.trim(),
    businessType,
    configuration: {
      resourceLabel: (resourceLabel || typeCfg.resourceLabel).trim(),
      resourcePlural: (resourcePlural || typeCfg.resourcePlural).trim(),
    },
    bookingFields: typeCfg.defaultBookingFields,
    ownerUid: uid,
  };

  await saveOrganization(organization);

  // El vínculo users/{uid} se crea ANTES de los recursos: las reglas de
  // "resources" exigen que el usuario ya tenga su organización asignada.
  await setDoc(userDocRef(uid), {
    organizationId,
    email: email.trim(),
    createdAt: new Date().toISOString(),
  });

  const count = Math.max(1, Math.min(50, Number(resourceCount) || 3));
  const label = organization.configuration.resourceLabel;
  const resources = [];
  for (let i = 1; i <= count; i++) {
    resources.push({
      id: `res${i}`,
      name: `${label} ${i}`,
      type: typeCfg.resourceType || 'custom',
      capacity: Math.max(0, Number(capacity) || 1),
    });
  }
  await seedResourcesCustom(organizationId, resources, organization);

  return { organizationId, organization, resources };
}

/**
 * Reclama la organización "default" (datos del restaurante actual) si aún no
 * tiene dueño. Preserva rubro, labels y recursos existentes.
 */
export async function claimDefaultOrganization(uid, email) {
  const snap = await getDoc(orgDocRef());
  const existing = snap.exists() ? snap.data() : null;
  if (existing && existing.ownerUid && existing.ownerUid !== uid) {
    const err = new Error('Esa cuenta ya pertenece a otro usuario.');
    err.code = 'ORG_OWNED';
    throw err;
  }

  const org = await saveOrganization({
    id: DEFAULT_ORG_ID,
    name: existing?.name || 'Andi',
    businessType: existing?.businessType || 'restaurant',
    configuration: existing?.configuration || {},
    bookingFields: existing?.bookingFields || bookingFieldsOf(normalizeOrganization(existing)),
    ownerUid: uid,
  });

  await setDoc(userDocRef(uid), {
    organizationId: DEFAULT_ORG_ID,
    email: email.trim(),
    createdAt: new Date().toISOString(),
  });

  return { organizationId: DEFAULT_ORG_ID, organization: org };
}

/**
 * Busca la organización del usuario autenticado.
 * @returns {Promise<{organizationId, organization} | null>} null si no tiene vínculo
 */
export async function fetchUserOrganization(uid) {
  const userSnap = await getDoc(userDocRef(uid)).catch(() => null);
  if (!userSnap || !userSnap.exists()) return null;
  const organizationId = userSnap.data().organizationId || DEFAULT_ORG_ID;
  const orgSnap = await getDoc(orgDocRef(organizationId)).catch(() => null);
  const organization = normalizeOrganization(
    orgSnap && orgSnap.exists() ? { id: orgSnap.id, ...orgSnap.data() } : { id: organizationId }
  );
  return { organizationId, organization };
}
