// useMesas.js — ADAPTADOR DE COMPATIBILIDAD.
// Delega en useResources devolviendo la vista legacy (solo mesas/tables).

import { useResources } from './useResources';

export function useMesas(config, organization = null) {
  const resources = useResources(config, organization);
  return resources.map(r => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    shape: r.shape,
    number: r.number ?? null,
    type: r.type,
  }));
}
