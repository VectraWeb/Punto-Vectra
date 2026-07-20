import React from 'react';
import { C, LIVE_STATES } from '../utils';

export function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(31,58,46,0.5)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 200, padding: '16px',
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: '24px',
        padding: '28px 20px 40px', width: '100%', maxWidth: '480px',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  );
}

export default function LiveStateModal({ res, tables, onSelect, onEdit, onClose, onFinalize, onReset }) {
  const table = tables.find(t => t.id === res.tableId);
  return (
    <Overlay onClose={onClose}>
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Estado de mesa</p>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>
          {res.customerName}
        </h3>
        <p style={{ fontSize: '12px', color: C.muted, margin: '4px 0 0' }}>
          {table?.name} · {res.partySize} comensales · {res.time}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {Object.entries(LIVE_STATES).map(([key, state]) => {
          const active = res.liveState === key;
          return (
            <button key={key} onClick={() => onSelect(key)} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 16px', borderRadius: '14px', cursor: 'pointer',
              border: `2px solid ${active ? state.color : C.creamDeep}`,
              background: active ? state.color : C.white,
              color: active ? '#fff' : C.espresso,
              fontWeight: active ? 600 : 400, fontSize: '14px',
            }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: state.dot, flexShrink: 0 }} />
              {state.label}
              {active && <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.8 }}>● actual</span>}
            </button>
          );
        })}
      </div>

      {res.liveState === 'para_limpiar' && (
        <div style={{ marginBottom: '16px' }}>
          <button onClick={onFinalize} style={{ width: '100%', padding: '14px', background: C.free, border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#fff', fontSize: '14px', fontWeight: 600 }}>
            Finalizar Reserva y Liberar Mesa
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onEdit} style={{ flex: 1, padding: '12px', background: C.creamDeep, border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', color: C.espresso }}>
          Editar reserva
        </button>
        <button onClick={onReset} style={{ padding: '12px 16px', background: 'transparent', border: `1.5px solid ${C.muted}`, borderRadius: '12px', cursor: 'pointer', color: C.muted, fontSize: '13px', fontWeight: 500 }}>
          Limpiar mesa
        </button>
        <button onClick={onClose} style={{ padding: '12px 20px', background: C.forest, border: 'none', borderRadius: '12px', cursor: 'pointer', color: C.cream, fontSize: '13px' }}>
          Cerrar
        </button>
      </div>
    </Overlay>
  );
}
