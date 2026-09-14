import { useState, useEffect } from 'react';
import { configApi } from '../services/api';
import { configToArray } from '../utils';

export function useConfig() {
  const [config, setConfig] = useState(null);
  const [sectors, setSectors] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const fetchConfig = async () => {
      try {
        const { data } = await configApi.getById('restaurant');
        if (!cancelled && data) {
          if (data.mesaTipos) {
            setConfig(data.mesaTipos);
          } else {
            setConfig(configToArray(data));
          }
          if (data.sectors) setSectors(data.sectors);
        }
      } catch (error) {
        console.warn('[useConfig] Error:', error);
      }
    };

    fetchConfig();

    const interval = setInterval(fetchConfig, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const saveSectors = async (updatedSectors) => {
    setSectors(updatedSectors);
    await configApi.patch('restaurant', { sectors: updatedSectors });
  };

  return { config, sectors, setSectors, saveSectors, cfgRef: null };
}
