// useAuth.js — Usuario actual mediante API REST.

import { useState, useEffect } from 'react';
import { authApi } from '../services/api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setInitializing(false);
        }
        return;
      }

      try {
        const { data } = await authApi.getMe();
        if (!cancelled && data.user) {
          setUser({
            uid: data.user.id || data.user.uid,
            id: data.user.id,
            email: data.user.email,
            isAnonymous: false,
            ...data.user,
          });
        }
      } catch (error) {
        if (!cancelled) {
          localStorage.removeItem('token');
          setUser(null);
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };

    checkAuth();
    return () => { cancelled = true; };
  }, []);

  return { user, initializing };
}
