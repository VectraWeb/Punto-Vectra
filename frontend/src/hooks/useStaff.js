import { useState, useEffect, useCallback } from 'react';
import { staffApi } from '../services/api';

export function useStaff() {
  const [staff, setStaff] = useState([]);

  const refetch = useCallback(async () => {
    try {
      const { data } = await staffApi.getByOrganization('default');
      setStaff(data || []);
    } catch (error) {
      console.warn('[useStaff] Error:', error);
    }
  }, []);

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  return [staff, refetch];
}
