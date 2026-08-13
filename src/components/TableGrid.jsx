import React from 'react';
import { C, LIVE_STATES } from '../utils';

const TableGrid = React.memo(function TableGrid({ tables, tableStatus, onTableClick }) {
  return (
    <div style={{ padding: '0 16px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '6px' }}>
        {tables.map(t => {
          const s = tableStatus(t.id);
          const live = s.status === 'busy' && s.res.liveState ? LIVE_STATES[s.res.liveState] : null;

          let bg, fg, border, sub;
          if (s.status === 'free') {
            bg = C.white; fg = C.forest; border = C.creamDeep; sub = `${t.capacity}p`;
          } else if (s.status === 'reserved') {
            bg = '#e8ddd0'; fg = C.forest; border = C.terra;
            sub = `→ ${s.res.time}`;
          } else if (s.status === 'busy') {
            bg = live?.color || C.terra; fg = C.white; border = live?.color || C.terra;
            sub = s.res.customerName?.split(' ')[0] || '—';
          } else {
            bg = C.soon; fg = C.white; border = C.soon; sub = 'A limpiar';
          }

          return (
            <button key={t.id} onClick={() => onTableClick(t, s)} style={{
              aspectRatio: t.shape === 'rectangular' ? '2/1' : '1', background: bg, color: fg,
              border: `1.5px solid ${border}`, borderRadius: t.shape === 'round' ? '50%' : t.shape === 'square' ? '12px' : t.shape === 'square-sm' ? '10px' : '10px',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: '4px',
              position: 'relative',
            }}>
              {live && (
                <span style={{ position: 'absolute', top: '5px', right: '5px', width: '8px', height: '8px', borderRadius: '50%', background: live.dot, border: '1.5px solid rgba(255,255,255,0.5)' }} />
              )}
              <div style={{ fontFamily: '"Fraunces", serif', fontSize: '17px', fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: '10px', opacity: 0.85, marginTop: '2px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                {live ? live.label : sub}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default TableGrid;
