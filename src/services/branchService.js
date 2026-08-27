// branchService.js — Sucursales de una organización.
// Subcolección: organizations/{organizationId}/branches/{branchId}.
// "main" es la sucursal por defecto (compat con los datos existentes).

import { collection, doc, getDocs, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_ORG_ID } from '../config/businessTypes';
import { normalizeBranch, branchDocData, DEFAULT_BRANCH_ID } from '../schemas/branchSchema';

export const branchesCol = (organizationId = DEFAULT_ORG_ID) =>
  collection(db, 'organizations', organizationId, 'branches');
export const branchDocRef = (organizationId, branchId) =>
  doc(db, 'organizations', organizationId, 'branches', branchId);

export async function getBranches(organizationId = DEFAULT_ORG_ID) {
  const snap = await getDocs(branchesCol(organizationId)).catch(() => null);
  if (!snap) return [];
  return snap.docs.map(d => normalizeBranch({ id: d.id, ...(d.data() || {}) }, organizationId));
}

/** Crea la sucursal "main" si la organización no tiene sucursales. */
export async function ensureDefaultBranch(organizationId = DEFAULT_ORG_ID) {
  const snap = await getDocs(branchesCol(organizationId)).catch(() => null);
  if (snap && !snap.empty) return normalizeBranch(snap.docs[0].data ? { id: snap.docs[0].id, ...snap.docs[0].data() } : {}, organizationId);
  const branch = {
    id: DEFAULT_BRANCH_ID,
    organizationId,
    name: 'Sucursal principal',
    timezone: 'America/Argentina/Buenos_Aires',
  };
  await setDoc(branchDocRef(organizationId, DEFAULT_BRANCH_ID), branchDocData(branch));
  return branch;
}

export function subscribeBranches(organizationId = DEFAULT_ORG_ID, callback) {
  return onSnapshot(
    branchesCol(organizationId),
    (snap) => {
      const branches = snap.docs.map(d => normalizeBranch({ id: d.id, ...(d.data() || {}) }, organizationId));
      callback(branches);
    },
    (err) => {
      console.warn('[branchService] Error suscribiendo sucursales:', err);
      callback([]);
    }
  );
}

export async function createBranch(organizationId, branch) {
  const id = branch.id || `branch_${Date.now().toString(36)}`;
  await setDoc(branchDocRef(organizationId, id), branchDocData({ ...branch, organizationId }));
  return { id, organizationId, ...branch };
}

export async function deleteBranch(organizationId, branchId) {
  if (branchId === DEFAULT_BRANCH_ID) {
    throw new Error('La sucursal principal no se puede eliminar.');
  }
  await deleteDoc(branchDocRef(organizationId, branchId));
}
