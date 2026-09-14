// useAvailability.js — Disponibilidad de recursos calculada en tiempo real
// sobre los datos en vivo (la escritura sigue protegida por el lock atómico).

import { useMemo } from 'react';
import { getAvailableResources, checkResourceAvailability } from '../services/availabilityService';

export function useAvailability({ resources, reservations, date, service, time, duration = 0, partySize = 0 }) {
  return useMemo(() => {
    const available = getAvailableResources({
      resources, reservations, date, service, time, duration, partySize,
    });

    const check = (resourceId) => checkResourceAvailability(resourceId, {
      resources, reservations, date, service, time, duration, partySize,
    });

    return { available, check };
  }, [resources, reservations, date, service, time, duration, partySize]);
}
