import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { configToArray } from '../utils';

const cfgRef = () => doc(db, 'config', 'restaurant');

export function useConfig() {
  const [config, setConfig] = useState(null);
  const [sectors, setSectors] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(cfgRef(), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.mesaTipos) {
          setConfig(data.mesaTipos);
        } else {
          setConfig(configToArray(data));
        }
        if (data.sectors) setSectors(data.sectors);
      }
    });
    return unsub;
  }, []);

  const saveSectors = async (updatedSectors) => {
    setSectors(updatedSectors);
    await setDoc(cfgRef(), { sectors: updatedSectors }, { merge: true });
  };

  return { config, sectors, setSectors, saveSectors, cfgRef };
}
