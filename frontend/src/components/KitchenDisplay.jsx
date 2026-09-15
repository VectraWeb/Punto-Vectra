import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Clock, Users, Volume2, VolumeX, Trash2 } from 'lucide-react';
import api from '../services/api/client';
import { useCatalog } from '../hooks/useCatalog';
import { C, LIVE_STATES, todayISO, setPrimaryColor, getPrimaryColor } from '../utils';

function ElapsedTimer({ startTime }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startTime) return;
    const tick = () => {
      const diff = Date.now() - new Date(startTime).getTime();
      const totalSec = Math.floor(diff / 1000);
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      if (hrs > 0) setElapsed(`${hrs}h ${String(mins).padStart(2, '0')}m`);
      else if (mins > 0) setElapsed(`${mins}m ${String(secs).padStart(2, '0')}s`);
      else setElapsed(`${secs}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  if (!elapsed) return null;

  const diff = Date.now() - new Date(startTime).getTime();
  const mins = Math.floor(diff / 60000);
  const color = mins >= 20 ? '#ef4444' : mins >= 10 ? '#fbbf24' : '#22c55e';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color, fontSize: '15px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
      <Clock size={14} />
      {elapsed}
    </div>
  );
}

function ComandaCard({ r, catalog, createdAt, onDelete }) {
  const tableName = r.resource?.name || r.resourceName || r.mesa || `Mesa ${r.resource?.number || '?'}`;
  const plates = r.plates || [];
  const state = LIVE_STATES[r.liveState] || null;

  const grouped = useMemo(() => {
    const cats = {};
    for (const p of plates) {
      const item = catalog.find(c => c.name === p.name);
      const cat = (item?.categoryId || item?.category || 'Otros').trim();
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push({ ...p, price: item?.price || 0 });
    }
    return cats;
  }, [plates, catalog]);

  const borderColor = state?.color || C.muted;

  return (
    <div style={{
      background: C.cream,
      border: `2px solid ${borderColor}`,
      borderRadius: '16px',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        background: state ? `${state.color}15` : `${C.terra}08`,
        borderBottom: `1px solid ${C.creamDeep}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{
            fontFamily: '"Fraunces", serif', fontSize: '24px', fontWeight: 700,
            color: C.espresso, whiteSpace: 'nowrap',
          }}>{tableName}</span>
          <button onClick={() => onDelete(r.id)} title="Eliminar comanda" style={{
            background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '8px',
            padding: '6px 8px', cursor: 'pointer', color: '#ef4444',
            display: 'flex', alignItems: 'center', flexShrink: 0,
          }}>
            <Trash2 size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            background: state?.color || C.terra, color: '#fff',
            padding: '3px 10px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 700,
          }}>{state?.label || 'Recibida'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: C.muted, fontSize: '13px' }}>
            <Users size={13} />
            <span style={{ fontWeight: 600 }}>{r.partySize || r.guests || '?'}</span>
          </div>
          <ElapsedTimer startTime={createdAt} />
        </div>
      </div>

      {/* Plates */}
      <div style={{ padding: '12px 16px', flex: 1 }}>
        {plates.length === 0 ? (
          <div style={{ color: C.muted, fontSize: '13px', textAlign: 'center', padding: '10px' }}>
            Sin platos cargados
          </div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: '8px' }}>
              <div style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: C.muted, marginBottom: '4px',
              }}>{cat}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {items.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: `${C.terra}10`, border: `1px solid ${C.creamDeep}`,
                    padding: '8px 12px', borderRadius: '8px',
                  }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: C.espresso }}>
                      {p.qty}x {p.name}
                    </span>
                    {p.price > 0 && (
                      <span style={{ fontSize: '13px', color: C.muted }}>
                        ${p.price.toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px', borderTop: `1px solid ${C.creamDeep}`,
        display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.muted,
      }}>
        <span>{r.customerName || '—'}</span>
        {r.staffName && <span>{r.staffName}</span>}
      </div>
    </div>
  );
}

export default function KitchenDisplay() {
  const [, setTick] = useState(0);
  const [reservations, setReservations] = useState([]);
  const catalog = useCatalog();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filter, setFilter] = useState('all');
  const prevCountRef = useRef(0);
  const audioCtxRef = useRef(null);

  // Escuchar cambios de color desde otra pestaña o desde el dashboard
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'pv_primary_color' && e.newValue) {
        setPrimaryColor(e.newValue);
        setTick(t => t + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    // Also poll in case same-tab changes happen
    const interval = setInterval(() => {
      const current = getPrimaryColor();
      const stored = localStorage.getItem('pv_primary_color');
      if (stored && stored !== current) {
        setPrimaryColor(stored);
        setTick(t => t + 1);
      }
    }, 2000);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  const fetchReservations = useCallback(async () => {
    try {
      const { data } = await api.get('/reservations/kitchen', { params: { date: todayISO() } });
      const filtered = (data || [])
        .filter(r => r.source !== 'whatsapp_bot')
        .filter(r => !['cancelled', 'no_show', 'expired'].includes(r.status))
        .filter(r => !['cancelado', 'no_show', 'ausente'].includes(r.estado));
      setReservations(filtered);
    } catch (err) {
      console.error('[KitchenDisplay] API error:', err);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
    const interval = setInterval(fetchReservations, 3000);
    return () => clearInterval(interval);
  }, [fetchReservations]);

  // Play beep on new comanda
  useEffect(() => {
    const withPlates = reservations.filter(r =>
      (r.tableId || r.resourceId) &&
      (r.plates || []).length > 0 &&
      r.liveState !== 'finalizado' && r.liveState !== 'para_limpiar'
    );
    if (soundEnabled && prevCountRef.current > 0 && withPlates.length > prevCountRef.current) {
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
      } catch {}
    }
    prevCountRef.current = withPlates.length;
  }, [reservations, soundEnabled]);

  const kitchenComandas = useMemo(() => {
    let list = reservations.filter(r =>
      (r.tableId || r.resourceId) &&
      r.liveState !== 'finalizado' && r.liveState !== 'para_limpiar'
    );
    if (filter === 'con_platos') {
      list = list.filter(r => (r.plates || []).length > 0);
    }
    return list.sort((a, b) => {
      const ta = a.stateLog?.length ? new Date(a.stateLog[a.stateLog.length - 1].at).getTime() : 0;
      const tb = b.stateLog?.length ? new Date(b.stateLog[b.stateLog.length - 1].at).getTime() : 0;
      return tb - ta;
    });
  }, [reservations, filter]);

  const handleDelete = useCallback(async (resId) => {
    if (!confirm('¿Eliminar esta comanda?')) return;
    try {
      await api.delete(`/reservations/${resId}`);
      setReservations(prev => prev.filter(r => r.id !== resId));
    } catch (err) {
      console.error('[KitchenDisplay] Delete error:', err);
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: C.creamDeep, color: C.espresso,
      fontFamily: '"Manrope", system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        background: C.forest,
        borderBottom: `2px solid ${C.forestSoft}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{
            fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic',
            fontWeight: 700, color: C.cream,
          }}>PuntoVectra</span>
          <span style={{
            background: C.terra, color: '#fff',
            padding: '4px 14px', borderRadius: '10px',
            fontSize: '13px', fontWeight: 700,
          }}>COCINA</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {[
            ['all', 'Todas'],
            ['con_platos', 'Con platos'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} style={{
              padding: '8px 16px', borderRadius: '10px', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
              background: filter === key ? C.terra : C.cream,
              color: filter === key ? '#fff' : C.muted,
              fontSize: '13px', fontWeight: 600,
            }}>{label}</button>
          ))}

          <button onClick={() => setSoundEnabled(!soundEnabled)} style={{
            background: C.cream, border: 'none', borderRadius: '10px',
            padding: '8px 12px', cursor: 'pointer',
            color: soundEnabled ? C.terra : C.muted,
            display: 'flex', alignItems: 'center',
          }}>
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          <span style={{ fontSize: '14px', color: C.cream, opacity: 0.7 }}>
            {kitchenComandas.length} comanda{kitchenComandas.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Comandas grid */}
      <div style={{
        padding: '20px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: '16px',
      }}>
        {kitchenComandas.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1', textAlign: 'center',
            color: C.muted, padding: '60px 20px',
            fontSize: '18px',
          }}>
            No hay comandas activas
          </div>
        ) : (
          kitchenComandas.map(r => (
            <ComandaCard
              key={r.id}
              r={r}
              catalog={catalog}
              createdAt={r.createdAt}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
