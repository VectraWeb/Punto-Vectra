import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
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
