import React, { useState } from 'react';
import { Users, Clock, User, RefreshCw, MapPin, XCircle } from 'lucide-react';
import { C, LIVE_STATES } from '../utils';

// Botón de rechazo con motivo inline (se usa antes de asignar mesa).
function RejectInline({ onReject }) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');

  if (!open) {
    return (
      <button
        type="button"
        title="Rechazar reserva"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        style={{
          flexShrink: 0, background: 'transparent', border: `1.5px solid #e06060`,
          borderRadius: '10px', padding: '8px', cursor: 'pointer', color: '#e06060',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <XCircle size={15} />
      </button>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0, maxWidth: '200px' }}
    >
      <input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo del rechazo..."
        autoFocus
        style={{
          width: '100%', padding: '7px 9px', fontSize: '12px', fontFamily: 'inherit',
          border: `1.5px solid ${C.creamDeep}`, borderRadius: '8px', color: C.espresso,
          outline: 'none', background: C.white,
        }}
      />
      <div style={{ display: 'flex', gap: '5px' }}>
        <button
          type="button"
          disabled={!motivo.trim()}
          onClick={(e) => { e.stopPropagation(); if (!motivo.trim()) return; onReject(motivo); setOpen(false); setMotivo(''); }}
          style={{
            flex: 1, padding: '6px 8px', background: motivo.trim() ? '#e06060' : C.creamDeep,
            border: 'none', borderRadius: '8px', cursor: motivo.trim() ? 'pointer' : 'not-allowed',
            color: motivo.trim() ? '#fff' : C.muted, fontSize: '11px', fontWeight: 700, fontFamily: 'inherit',
          }}
        >
          Rechazar
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(false); setMotivo(''); }}
          style={{
            padding: '6px 8px', background: C.creamDeep, border: 'none',
            borderRadius: '8px', cursor: 'pointer', color: C.muted, fontSize: '11px', fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

const ReservationList = React.memo(function ReservationList({ sortedRes, tables, onEdit, onAction, onGoToTable, onPlanoHover, onReject }) {
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
        const isDone = r.liveState === 'finalizado' || r.liveState === 'para_limpiar';
        const started = r.liveState && !isDone;
        const live = started ? LIVE_STATES[r.liveState] : null;

        let badgeLabel = 'Próxima';
        let badgeColor = C.forestSoft;
        if (r.liveState === 'finalizado') {
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
          <div key={r.id} role="button" tabIndex={0} onClick={() => onEdit(r)}
            onKeyDown={(e) => { if (e.key === 'Enter') onEdit(r); }}
            style={{
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
                <span style={{ fontWeight: 600, color: C.forest }}>{r.mesa || table?.name || '—'}</span>
                <span>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} />{r.time}</span>
                {r.phone && (<><span>·</span><span>{r.phone}</span></>)}
                {r.staffName && (<><span>·</span><span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><User size={10} />{r.staffName}</span></>)}
              </div>
              {r.notes && <div style={{ fontSize: '11px', color: C.terra, marginTop: '3px', fontStyle: 'italic' }}>{r.notes}</div>}
            </div>
            {!isDone && onReject && r.estado === 'pendiente' && (
              <RejectInline onReject={(motivo) => onReject(r, motivo)} />
            )}
            {!isDone && (
              onGoToTable ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGoToTable(r);
                  }}
                  onMouseEnter={() => onPlanoHover?.(true)}
                  onMouseLeave={() => onPlanoHover?.(false)}
                  style={{
                    flexShrink: 0, background: badgeColor,
                    border: 'none', borderRadius: '12px', padding: '10px 12px',
                    cursor: 'pointer', color: C.white,
                    fontSize: '11px', fontWeight: 700, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '3px', minWidth: '64px', minHeight: '48px',
                    fontFamily: 'inherit',
                  }}
                >
                  <MapPin size={15} />
                  <span>Plano</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(r);
                  }}
                  style={{
                    flexShrink: 0, background: badgeColor,
                    border: 'none', borderRadius: '12px', padding: '10px 12px',
                    cursor: 'pointer', color: C.white,
                    fontSize: '11px', fontWeight: 700, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '3px', minWidth: '64px', minHeight: '48px',
                    fontFamily: 'inherit',
                  }}
                >
                  {started ? <RefreshCw size={14} /> : <span style={{ fontSize: '16px' }}>▶</span>}
                  <span>{badgeLabel}</span>
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
});

export default ReservationList;
