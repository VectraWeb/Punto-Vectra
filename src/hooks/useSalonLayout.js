// useSalonLayout.js — Suscripción única a las posiciones del salón
// (compartida entre SalonFloor y useMozoTableNumbers, antes duplicada)
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const layoutRef = () => doc(db, 'config', 'salon-layout');

export function useSalonLayout() {
  const [positions, setPositions] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(layoutRef(), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.positions) setPositions(data.positions);
      }
    });
    return unsub;
  }, []);

  const saveLayout = useCallback(async (pos) => {
    await setDoc(layoutRef(), { positions: pos, updatedAt: new Date().toISOString() }, { merge: true });
  }, []);

  return { positions, setPositions, saveLayout };
}