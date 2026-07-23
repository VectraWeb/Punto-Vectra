import React from 'react';
import { Users, Clock, User, RefreshCw } from 'lucide-react';
import { C, LIVE_STATES } from '../utils';

const ReservationList = React.memo(function ReservationList({ sortedRes, tables, onEdit, onAction }) {
  if (sortedRes.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted, background: C.creamDeep, borderRadius: '14px', fontSize: '13px' }}>
        Sin reservas para este servicio
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {sortedRes.map(r => {
        const table = tables.find(t => t.id === r.tableId);
        const isDone = r.liveState === 'para_limpiar' || r.liveState === 'finalizada';
        const started = r.liveState && !isDone;
        const live = started ? LIVE_STATES[r.liveState] : null;

        let badgeLabel = 'Próxima';
        let badgeColor = C.forestSoft;
        if (r.liveState === 'finalizada') {
          badgeLabel = 'Finalizada';
          badgeColor = C.muted;
        } else if (r.liveState === 'para_limpiar') {
          badgeLabel = 'A limpiar';
          badgeColor = C.soon;
        } else if (live) {
          badgeLabel = live.label;
          badgeColor = live.color;
        }

        return (
          <button key={r.id} onClick={() => onEdit(r)} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
            background: C.white, border: `1px solid ${C.creamDeep}`,
            borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
            color: C.espresso, opacity: isDone ? 0.5 : 1,
          }}>
            {/* Indicador de hora con color */}
            <div style={{
              width: '52px', minWidth: '52px', height: '52px', borderRadius: '12px',
              background: badgeColor, color: C.cream,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: '"Fraunces", serif', fontSize: '15px', fontWeight: 600,
              flexDirection: 'column', gap: '1px',
            }}>
              <span>{r.time}</span>
              <span style={{ fontSize: '8px', opacity: 0.85 }}>{badgeLabel}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customerName}</div>
              <div style={{ fontSize: '11px', color: C.muted, display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Users size={10} />{r.partySize}</span>
                <span>·</span>
                <span style={{ fontWeight: 600, color: C.forest }}>{table?.name || '—'}</span>
                <span>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} />{r.time}</span>
                {r.phone && (<><span>·</span><span>{r.phone}</span></>)}
                {r.staffName && (<><span>·</span><span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><User size={10} />{r.staffName}</span></>)}
              </div>
              {r.notes && <div style={{ fontSize: '11px', color: C.terra, marginTop: '3px', fontStyle: 'italic' }}>{r.notes}</div>}
            </div>
            {!isDone && (
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(r);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onAction(r); } }}
                style={{
                  flexShrink: 0, background: badgeColor,
                  border: 'none', borderRadius: '10px', padding: '6px 8px',
                  cursor: 'pointer', color: C.white,
                  fontSize: '10px', fontWeight: 600, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: '2px', minWidth: '52px',
                }}
              >
                {started ? <RefreshCw size={12} /> : <span style={{ fontSize: '14px' }}>▶</span>}
                <span>{badgeLabel}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
});

export default ReservationList;
