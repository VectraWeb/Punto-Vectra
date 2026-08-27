// useBranches.js — Sucursales de la organización en tiempo real.

import { useState, useEffect } from 'react';
import { subscribeBranches, ensureDefaultBranch } from '../services/branchService';
import { DEFAULT_BRANCH_ID } from '../schemas/branchSchema';

export function useBranches(organizationId, { ensure = false } = {}) {
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (!organizationId) return undefined;
    if (ensure) {
      ensureDefaultBranch(organizationId).catch((e) => console.warn('[useBranches] Error asegurando sucursal:', e));
    }
    const unsub = subscribeBranches(organizationId, setBranches);
    return unsub;
  }, [organizationId, ensure]);

  return branches;
}

export function resolveBranchId(branches, selected) {
  if (selected) return selected;
  if (Array.isArray(branches) && branches.length > 0) return branches[0].id;
  return DEFAULT_BRANCH_ID;
}
