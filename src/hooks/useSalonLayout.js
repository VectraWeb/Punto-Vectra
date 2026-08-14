// useSalonLayout.js — Suscripción única a las posiciones del salón
// (compartida entre SalonFloor y useMozoTableNumbers, antes duplicada)
// Incluye los grupos de mesas unidas (joined tables).
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const layoutRef = () => doc(db, 'config', 'salon-layout');

export function useSalonLayout() {
  const [positions, setPositions] = useState({});
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(layoutRef(), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.positions) setPositions(data.positions);
        if (Array.isArray(data.groups)) setGroups(data.groups);
      }
    });
    return unsub;
  }, []);

  const saveLayout = useCallback(async (pos, grp) => {
    await setDoc(layoutRef(), {
      positions: pos,
      groups: grp || [],
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }, []);

  return { positions, setPositions, groups, setGroups, saveLayout };
}