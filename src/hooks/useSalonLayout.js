// useSalonLayout.js — Suscripción única a las posiciones del salón
// (compartida entre SalonFloor y useMozoTableNumbers, antes duplicada)
// Incluye los grupos de mesas unidas (joined tables) y el mozo elegido
// para cada grupo que cruza sectores.
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const layoutRef = () => doc(db, 'config', 'salon-layout');

// Clave estable para un grupo (orden de ids normalizado)
export const groupKey = (g) => [...g].sort().join('|');

export function useSalonLayout() {
  const [positions, setPositions] = useState({});
  const [groups, setGroups] = useState([]);
  const [groupOwners, setGroupOwners] = useState({});
  const groupOwnersRef = useRef({});
  const positionsRef = useRef({});
  const groupsRef = useRef([]);

  // Refs espejo para poder persistir el estado local (no guardado aún)
  // desde saveGroupOwner sin depender de closures viejos.
  useEffect(() => { positionsRef.current = positions; }, [positions]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);

  useEffect(() => {
    const unsub = onSnapshot(layoutRef(), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.positions) setPositions(data.positions);
        if (Array.isArray(data.groups)) setGroups(data.groups);
        const go = data.groupOwners && typeof data.groupOwners === 'object' ? data.groupOwners : {};
        groupOwnersRef.current = go;
        setGroupOwners(go);
      }
    });
    return unsub;
  }, []);

  const saveLayout = useCallback(async (pos, grp) => {
    // Purgar owners de grupos que ya no existen (mesas separadas)
    const validKeys = new Set((grp || []).map(groupKey));
    const pruned = {};
    for (const [k, v] of Object.entries(groupOwnersRef.current)) {
      if (validKeys.has(k)) pruned[k] = v;
    }
    groupOwnersRef.current = pruned;
    setGroupOwners(pruned);
    positionsRef.current = pos;
    groupsRef.current = grp || [];
    await setDoc(layoutRef(), {
      positions: pos,
      groups: grp || [],
      groupOwners: pruned,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }, []);

  // Guardar el mozo que conserva una mesa unida que cruza sectores.
  // Persiste también posiciones y grupos locales para que el snapshot que
  // dispara la escritura no revierta el plano a la versión guardada antes.
  const saveGroupOwner = useCallback(async (key, ownerId) => {
    const next = { ...groupOwnersRef.current, [key]: ownerId };
    groupOwnersRef.current = next;
    setGroupOwners(next);
    try {
      await setDoc(layoutRef(), {
        positions: positionsRef.current,
        groups: groupsRef.current,
        groupOwners: next,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Andi] Error guardando mozo de grupo:', e);
    }
  }, []);

  return { positions, setPositions, groups, setGroups, saveLayout, groupOwners, saveGroupOwner };
}
