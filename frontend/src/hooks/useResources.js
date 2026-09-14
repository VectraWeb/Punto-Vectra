// useResources.js — Hook genérico de recursos reservables.

import { useState, useEffect, useMemo } from 'react';
import { subscribeResources, seedResourcesIfNeeded } from '../services/resourceService';
import { resourceTypeOf } from '../config/businessTypes';

export function useResources(config, organization = null, { enabled = true } = {}) {
  const [resources, setResources] = useState([]);

  const seedKey = useMemo(() => {
    if (!config || !enabled) return null;
    return `${organization?.id || 'default'}|${organization?.businessType || 'restaurant'}|${JSON.stringify(config)}`;
  }, [config, enabled, organization?.id, organization?.businessType]);

  useEffect(() => {
    if (!seedKey) return;
    seedResourcesIfNeeded(config, {
      organization,
      resourceType: resourceTypeOf(organization),
    });
  }, [seedKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    const unsub = subscribeResources((list) => {
      setResources(list);
    }, { organization });
    return unsub;
  }, [enabled, organization?.id, organization?.businessType]);

  return resources;
}
