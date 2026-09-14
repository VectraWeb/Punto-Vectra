// useOrganization.js — Organización actual mediante API REST.

import { useState, useEffect, useCallback } from 'react';
import { subscribeOrganization, ensureDefaultOrganization } from '../services/organizationService';
import { DEFAULT_ORG_ID, DEFAULT_ORGANIZATION } from '../config/businessTypes';

export function useOrganization(id = DEFAULT_ORG_ID, { ensure = false } = {}) {
  const [organization, setOrganization] = useState({ ...DEFAULT_ORGANIZATION, id });

  useEffect(() => {
    let cancelled = false;
    if (ensure) {
      ensureDefaultOrganization().then((org) => {
        if (!cancelled) setOrganization(org);
      });
    }
    const unsub = subscribeOrganization(id, (org) => {
      if (!cancelled) setOrganization(org);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [id, ensure]);

  const updateOrganization = useCallback((updater) => {
    setOrganization(prev => typeof updater === 'function' ? updater(prev) : updater);
  }, []);

  return [organization, updateOrganization];
}
