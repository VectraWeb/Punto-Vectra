import { C, LIVE_STATES } from '../utils';
import { useCleaningCountdown } from '../hooks/useCleaningTimers';

export function Overlay({ children, onClose, maxWidth = '480px' }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(31,58,46,0.5)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 200, padding: '16px',
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: '24px',
        padding: '28px 20px 40px', width: '100%', maxWidth,
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  );
}

function formatCountdown(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LiveStateModal({
  res, tables, cleaningTimer: cleaningTimerProp,
  onSelect, onEdit, onClose, onFinalize, onReset,
  onExtend, onCancelCleaning,
}) {
  const table = tables.find(t => t.id === res.tableId);
  const cleaningTimer = useCleaningCountdown(cleaningTimerProp?.expiresAt);
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
              {active && <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                actual
              </span>}
            </button>
          );
        })}
      </div>

      {res.liveState === 'para_limpiar' && cleaningTimer && (
        <div style={{ marginBottom: '16px', padding: '14px', background: C.white, borderRadius: '14px', border: `1px solid ${C.creamDeep}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: C.muted, fontWeight: 600 }}>Limpieza automática</span>
            <span style={{
              fontFamily: '"Fraunces", serif', fontSize: '22px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              color: cleaningTimer.progress > 0.66 ? C.free : cleaningTimer.progress > 0.13 ? '#d4a04a' : '#c0392b',
            }}>
              {formatCountdown(cleaningTimer.remainingSec)}
            </span>
          </div>
          <div style={{ width: '100%', height: '6px', background: C.creamDeep, borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${cleaningTimer.progress * 100}%`, height: '100%',
              background: cleaningTimer.progress > 0.66 ? C.free : cleaningTimer.progress > 0.13 ? '#d4a04a' : '#c0392b',
              borderRadius: '3px', transition: 'width 1s linear',
            }} />
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <button onClick={onFinalize} style={{
              flex: 1, padding: '10px', background: C.free, border: 'none', borderRadius: '10px',
              cursor: 'pointer', color: '#fff', fontSize: '12px', fontWeight: 600,
            }}>
              Finalizar ahora
            </button>
            <button onClick={onExtend} style={{
              flex: 1, padding: '10px', background: '#d4a04a', border: 'none', borderRadius: '10px',
              cursor: 'pointer', color: '#fff', fontSize: '12px', fontWeight: 600,
            }}>
              +5 min
            </button>
            <button onClick={onCancelCleaning} style={{
              padding: '10px', background: 'transparent', border: `1.5px solid ${C.muted}`, borderRadius: '10px',
              cursor: 'pointer', color: C.muted, fontSize: '12px',
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {res.liveState === 'para_limpiar' && !cleaningTimer && (
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
