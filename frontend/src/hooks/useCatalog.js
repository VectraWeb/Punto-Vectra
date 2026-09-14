import { useState, useEffect } from 'react';
import { catalogApi } from '../services/api';
import { normalizeCatalogItem } from '../schemas/catalogSchema';
import { DEFAULT_ORG_ID } from '../config/businessTypes';

export function useCatalog() {
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      try {
        const { data } = await catalogApi.getByOrganization(DEFAULT_ORG_ID);
        if (!cancelled) setCatalog((data || []).map(i => normalizeCatalogItem(i)));
      } catch (e) {
        console.warn('[useCatalog] Error:', e);
      }
    };

    fetch();
    const interval = setInterval(fetch, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return catalog;
}
