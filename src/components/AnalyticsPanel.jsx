import { X } from 'lucide-react';
import { C, LIVE_STATES } from '../utils';

export function AnalyticsPanel({ data, period, onPeriodChange, onClose }) {
  const { totalCustomers, avgStay, stateBreakdown } = data;
  const fmtMin = (m) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}min` : `${m}min`;
  const periods = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']];

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>Analíticas</h3>
        <button onClick={onClose} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
      </div>

      {/* Selector de período */}
      <div style={{ display: 'flex', gap: '4px', background: C.creamDeep, borderRadius: '12px', padding: '4px', marginBottom: '24px' }}>
        {periods.map(([key, label]) => (
          <button key={key} onClick={() => onPeriodChange(key)} style={{
            flex: 1, padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: period === key ? C.white : 'transparent',
            color: period === key ? C.forest : C.muted,
            fontWeight: period === key ? 600 : 400,
            fontSize: '13px', fontFamily: 'inherit',
            boxShadow: period === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      {totalCustomers === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted, background: C.creamDeep, borderRadius: '14px', fontSize: '13px' }}>
          Sin datos para este período
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <div style={{ flex: 1, background: C.white, border: `1.5px solid ${C.creamDeep}`, borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontFamily: '"Fraunces", serif', fontSize: '32px', fontWeight: 700, color: C.terra, lineHeight: 1 }}>{totalCustomers}</div>
              <div style={{ fontSize: '11px', color: C.muted, marginTop: '6px', letterSpacing: '0.05em' }}>Clientes</div>
            </div>
            <div style={{ flex: 1, background: C.white, border: `1.5px solid ${C.creamDeep}`, borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontFamily: '"Fraunces", serif', fontSize: '32px', fontWeight: 700, color: C.forest, lineHeight: 1 }}>{fmtMin(avgStay)}</div>
              <div style={{ fontSize: '11px', color: C.muted, marginTop: '6px', letterSpacing: '0.05em' }}>Perm. promedio</div>
            </div>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 600, color: C.espresso, marginBottom: '12px', letterSpacing: '0.03em' }}>
            Desglose por estado y comensales
          </div>

          {stateBreakdown && Object.keys(stateBreakdown).length > 0 ? (
            <>
              {/* ── BARRAS DE ESTADO ── */}
              <div style={{ marginBottom: '16px', background: C.white, borderRadius: '12px', padding: '12px', border: `1px solid ${C.creamDeep}` }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: C.forest, marginBottom: '10px' }}>
                  Tiempo promedio por estado
                </div>
                {(() => {
                  const stateAvgs = {};
                  Object.values(stateBreakdown).forEach(states => {
                    Object.entries(states).forEach(([state, { avg }]) => {
                      if (!stateAvgs[state]) stateAvgs[state] = { total: 0, count: 0 };
                      stateAvgs[state].total += avg;
                      stateAvgs[state].count += 1;
                    });
                  });
                  const maxAvg = Math.max(...Object.values(stateAvgs).map(s => s.total / s.count), 1);
                  return Object.entries(stateAvgs)
                    .sort(([,a], [,b]) => (b.total / b.count) - (a.total / a.count))
                    .map(([state, { total, count }]) => {
                      const avg = total / count;
                      const pct = Math.max((avg / maxAvg) * 100, 4);
                      const st = LIVE_STATES[state];
                      return (
                        <div key={state} style={{ marginBottom: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ fontSize: '10px', color: C.muted }}>{st?.label || state}</span>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: C.espresso }}>{fmtMin(Math.round(avg))}</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: C.creamDeep, borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: st?.color || C.muted,
                              borderRadius: '3px', transition: 'width 0.3s ease',
                            }} />
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>

              {/* ── DESGLOSE POR COMENSALES ── */}
              {Object.entries(stateBreakdown)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([ps, states]) => (
                  <div key={ps} style={{ marginBottom: '12px', background: C.white, borderRadius: '12px', padding: '12px', border: `1px solid ${C.creamDeep}` }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: C.forest, marginBottom: '6px' }}>
                      {ps} comensales
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {Object.entries(states).map(([state, { avg }]) => (
                        <div key={state} style={{
                          background: C.creamDeep, borderRadius: '8px', padding: '4px 8px',
                          fontSize: '11px', color: C.espresso, whiteSpace: 'nowrap',
                          display: 'inline-flex', alignItems: 'center', gap: '2px',
                        }}>
                          <span style={{ color: C.muted }}>{(LIVE_STATES[state]?.label || state).slice(0, 8)}</span>
                          <span style={{ fontWeight: 600 }}>{fmtMin(avg)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              }
            </>
          ) : (
            <div style={{ padding: '16px', textAlign: 'center', color: C.muted, background: C.creamDeep, borderRadius: '14px', fontSize: '12px' }}>
              Las transiciones de estado aparecerán aquí a medida que cambien las mesas en el salón.
            </div>
          )}
        </>
      )}
    </Overlay>
  );
}

export function Overlay({ children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{
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

export function Stat({ color, label, value }) {
  return (
    <div style={{ flex: 1, background: C.white, border: `1.5px solid ${C.creamDeep}`, borderRadius: '14px', padding: '12px', textAlign: 'center' }}>
      <div style={{ fontFamily: '"Fraunces", serif', fontSize: '28px', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '10px', color: C.muted, marginTop: '4px', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}
