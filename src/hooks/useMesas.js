import { useState, useEffect } from 'react';
import { subscribeMesas, seedMesasIfNeeded } from '../services/mesasHelpers';

export function useMesas(config) {
  const [mesas, setMesas] = useState([]);

  useEffect(() => {
    if (config) seedMesasIfNeeded(config);
  }, [config]);

  useEffect(() => {
    const unsub = subscribeMesas(setMesas);
    return unsub;
  }, []);

  return mesas;
}
