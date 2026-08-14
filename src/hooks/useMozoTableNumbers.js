import { useMemo } from 'react';
import { getAssignedTables, rectsOverlap } from '../utils';

const TABLE_DIMS = {
  rectangular: { w: 130, h: 65 },
  round:       { w: 90, h: 90 },
  square:      { w: 100, h: 100 },
};

// Mapea las mesas físicas del plano con los números que el administrador le
// asignó a cada mozo. Cada mozo elige libremente sus números (assignedTables);
// su sector (geometría) define sobre qué mesas físicas recaen, por posición
// (izq→der, arriba→abajo). El plano se adapta al mozo, nunca al revés.
// positions viene de useSalonLayout (suscripción única compartida).
export function useMozoTableNumbers(tables, staff, sectors, positions = {}) {
  return useMemo(() => {
    const tableNumByTable = {};
    const ownerByTable = {};
    const mozoTableIds = {};
    const tds = tables || [];

    for (const mozo of staff || []) {
      if (mozo.active === false) continue;
      const sec = (sectors || []).find(s => s.name === mozo.name);
      if (!sec) continue;
      const nums = getAssignedTables(mozo);
      const inside = tds
        .filter(t => {
          const p = positions[t.id];
          if (!p) return false;
          const dim = TABLE_DIMS[t.shape] || TABLE_DIMS.round;
          return rectsOverlap(sec, { x: p.x, y: p.y, w: dim.w, h: dim.h });
        })
        .sort((a, b) => {
          const pa = positions[a.id] || { x: 0, y: 0 };
          const pb = positions[b.id] || { x: 0, y: 0 };
          return pa.x !== pb.x ? pa.x - pb.x : pa.y - pb.y;
        });
      mozoTableIds[mozo.id] = inside.map(t => t.id);
      inside.forEach((t, i) => {
        // Los IDs físicos legados (m13, m21...) NO son números elegidos: se ignoran.
        const raw = nums[i] != null ? String(nums[i]) : '';
        const num = /^m\d+$/i.test(raw) ? null : raw.replace(/^m/i, '');
        if (num) {
          tableNumByTable[t.id] = num;
          ownerByTable[t.id] = mozo.id;
        }
      });
    }

    return { tableNumByTable, ownerByTable, mozoTableIds };
  }, [tables, staff, sectors, positions]);
}