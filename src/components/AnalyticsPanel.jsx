import { X } from 'lucide-react';
import { C, LIVE_STATES } from '../utils';
import { Overlay } from './ui';

export function AnalyticsPanel({ data, period, onPeriodChange, analyticsMonth, onMonthChange, onClose }) {
  const { totalCustomers, avgStay, stateBreakdown, monthlyTrend } = data;
  const fmtMin = (m) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}min` : `${m}min`;
  const periods = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['trend', 'Gráfico']];


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

      {/* Selector de mes (solo visible en modo Mes) */}
      {period === 'month' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
          <button onClick={() => {
            const [y, m] = analyticsMonth.split('-').map(Number);
            const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
            onMonthChange(prev);
          }} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', color: C.muted, fontSize: '14px', fontWeight: 600 }}>◀</button>
          <input type="month" value={analyticsMonth} onChange={e => onMonthChange(e.target.value)} style={{
            background: C.white, border: `1.5px solid ${C.creamDeep}`, borderRadius: '10px',
            padding: '8px 12px', fontSize: '14px', fontWeight: 600, color: C.espresso,
            fontFamily: 'inherit', cursor: 'pointer', textAlign: 'center',
          }} />
          <button onClick={() => {
            const [y, m] = analyticsMonth.split('-').map(Number);
            const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
            const nowMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
            if (next <= nowMonth) onMonthChange(next);
          }} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', color: C.muted, fontSize: '14px', fontWeight: 600 }}>▶</button>
        </div>
      )}

      {/* ── VISTA TENDENCIA: Gráfico de barras + línea de tendencia ── */}
      {period === 'trend' && (() => {
        const months = Object.entries(monthlyTrend || {})
          .map(([key, customers]) => ({ key, customers }))
          .sort((a, b) => a.key.localeCompare(b.key));

        const maxCustomers = Math.max(...months.map(m => m.customers), 1);
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        const chartH = 50;
        const n = months.length;
        const barW = n > 0 ? Math.min(10, Math.floor(160 / n)) : 10;

        return (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: C.espresso }}>Clientes por mes</div>
            </div>

            {months.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted, background: C.creamDeep, borderRadius: '14px', fontSize: '13px' }}>
                Sin datos de tendencia
              </div>
            ) : (
              <div style={{ background: C.white, borderRadius: '12px', padding: '20px 16px 12px', border: `1px solid ${C.creamDeep}`, overflowX: 'auto' }}>
                <svg width="100%" viewBox={`0 0 ${Math.max(months.length * (barW + 4) + 16, 200)} ${chartH + 120}`} style={{ display: 'block' }}>
                  {/* Barras */}
                  {months.map((m, i) => {
                    const x = 8 + i * (barW + 4);
                    const h = Math.max((m.customers / maxCustomers) * chartH, 3);
                    const y = (chartH + 120) - 30 - h;
                    const [yr, mo] = m.key.split('-').map(Number);
                    return (
                      <g key={m.key}>
                        <rect x={x} y={y} width={barW} height={h} rx="3" fill={C.terra} opacity="0.85" />
                        <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="8" fontWeight="700" fill={C.espresso}>{m.customers}</text>
                        <text x={x + barW / 2} y={(chartH + 120) - 14} textAnchor="middle" fontSize="7" fill={C.muted}>{monthNames[mo - 1]}</text>
                        <text x={x + barW / 2} y={(chartH + 120) - 4} textAnchor="middle" fontSize="6" fill={C.muted} opacity="0.6">{String(yr).slice(2)}</text>
                      </g>
                    );
                  })}

                </svg>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '4px', fontSize: '10px', color: C.muted }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'inline-block', width: '12px', height: '8px', borderRadius: '2px', background: C.terra, opacity: 0.85 }} />
                    Clientes
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {totalCustomers === 0 && period !== 'trend' && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted, background: C.creamDeep, borderRadius: '14px', fontSize: '13px' }}>
          Sin datos para este período
        </div>
      )}

      {period !== 'trend' && totalCustomers > 0 && (
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
