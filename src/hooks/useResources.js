// useResources.js — Hook genérico de recursos reservables.
// Reemplazo natural de useMesas: devuelve recursos normalizados (un recurso
// tipo "table" incluye id/name/capacity/shape, igual que una mesa legacy).

import { useState, useEffect, useMemo } from 'react';
import { subscribeResources, seedResourcesIfNeeded } from '../services/resourceService';
import { resourceTypeOf } from '../config/businessTypes';

export function useResources(config, organization = null, { enabled = true } = {}) {
  const [resources, setResources] = useState([]);

  // Clave estable de la configuración: siembra solo cuando cambia la config o
  // el tipo de negocio (no en cada snapshot de la organización).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    const unsub = subscribeResources((list) => {
      setResources(list);
    }, { organization });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, organization?.id, organization?.businessType]);

  return resources;
}
