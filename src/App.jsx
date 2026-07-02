// App.js — Andi MVP (Producción)
// PWA de gestión de mesas con sincronización en tiempo real vía Firebase Firestore
// Incluye máquina de estados en vivo para mozos

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus, Users, Phone, X, Trash2, Settings, Sun, Moon,
  ChevronLeft, ChevronRight, Clock, Wifi, WifiOff, RefreshCw, BarChart3,
} from 'lucide-react';
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, getDocs,
  serverTimestamp, query, where,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  cream:      '#f5efe6',
  creamDeep:  '#ebe3d5',
  forest:     '#7a3a1e',
  forestSoft: '#9B4B2A',
  terra:      '#c4602f',
  terraSoft:  '#e09368',
  espresso:   '#2a1f1a',
  muted:      '#8b7d6b',
  free:       '#6f8d4d',
  soon:       '#d4a04a',
  white:      '#fffdf8',
};

// ─── Máquina de estados en vivo ──────────────────────────────────────────────
export const LIVE_STATES = {
  esperando_cliente:  { label: 'Esperando',       color: '#4a90d9', dot: '#2171c7' },
  comiendo_entrada:   { label: 'Entrada',          color: '#c4602f', dot: '#a04020' },
  plato_principal:    { label: 'Principal',        color: '#7b1f2e', dot: '#5c1520' },
  en_postre_cafe:     { label: 'Postre / Café',    color: '#c49a35', dot: '#a07820' },
  esperando_cuenta:   { label: 'Cuenta',           color: '#9b59b6', dot: '#7d3f9c' },
  para_limpiar:       { label: 'A limpiar',        color: '#e67e22', dot: '#c05e0a' },
};

// ─── Servicios ───────────────────────────────────────────────────────────────
const SERVICES = {
  mediodia: { name: 'Mediodía', start: '11:30', end: '15:00', defaultDuration: 90,  icon: Sun  },
  cena:     { name: 'Cena',     start: '19:30', end: '01:00', defaultDuration: 120, icon: Moon },
};

const DEFAULT_CONFIG = { cap2: 2, cap4: 2, cap5: 2, cap8: 2 };

// ─── Utilidades de tiempo ────────────────────────────────────────────────────
const t2m = (time, service) => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  if (service === 'cena' && h < 12) return (h + 24) * 60 + m;
  return h * 60 + m;
};

const m2t = (mins) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const genSlots = (service) => {
  const start = t2m(SERVICES[service].start, service);
  const end   = t2m(SERVICES[service].end,   service);
  const slots = [];
  for (let m = start; m <= end; m += 15) slots.push(m2t(m));
  return slots;
};

const buildTables = (cfg) => {
  const tables = [];
  let n = 1;
  const groups = [
    { count: cfg.cap2 || 0, capacity: 2 },
    { count: cfg.cap4 || 0, capacity: 4 },
    { count: cfg.cap5 || 0, capacity: 5 },
    { count: cfg.cap8 || 0, capacity: 8 },
  ];
  for (const { count, capacity } of groups) {
    for (let i = 0; i < count; i++) {
      tables.push({ id: `m${n}`, name: `M${n}`, capacity });
      n++;
    }
  }
  return tables;
};

const todayISO     = ()  => new Date().toISOString().slice(0, 10);
const formatDate   = (iso) => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
};
const detectService = ()       => { const h = new Date().getHours(); return (h >= 11 && h < 17) ? 'mediodia' : 'cena'; };
const detectTime    = (svc)    => {
  const now = new Date();
  const h   = now.getHours();
  const m   = now.getMinutes();
  const slots = genSlots(svc);
  const target = svc === 'cena' && h < 12 ? (h + 24) * 60 + m : h * 60 + m;
  let best = slots[0], bestDiff = Infinity;
  for (const s of slots) {
    const diff = Math.abs(t2m(s, svc) - target);
    if (diff < bestDiff) { best = s; bestDiff = diff; }
  }
  return best;
};

// ─── Firestore helpers ───────────────────────────────────────────────────────
const resCol    = (date) => collection(db, 'reservations', date, 'items');
const resDocRef = (date, id) => doc(db, 'reservations', date, 'items', id);
const cfgRef    = () => doc(db, 'config', 'restaurant');

// ─── Utilidad N8N ────────────────────────────────────────────────────────────
const notificarN8N = (datos) => {
  fetch('http://localhost:5678/webhook-test/23b4cd63-a7e2-456b-a191-75a2e7416672', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  }).catch(err => console.error('[Andi] Error silencioso al notificar a n8n:', err));
};

// ═══════════════════════════════════════════════════════════════════════════════
// App Principal
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [date,        setDate]        = useState(todayISO);
  const [service,     setService]     = useState(detectService);
  const [currentTime, setCurrentTime] = useState(() => detectTime(detectService()));
  const [config,      setConfig]      = useState(DEFAULT_CONFIG);
  const [reservations,setReservations]= useState([]);
  const [online,      setOnline]      = useState(navigator.onLine);

  // Modales
  const [showModal,    setShowModal]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [preTable,     setPreTable]     = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showLiveMenu, setShowLiveMenu] = useState(null); // reserva seleccionada para cambiar estado
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('day');
  const [analyticsRes, setAnalyticsRes] = useState([]);
  const [mainTab, setMainTab] = useState('mesas');
  const [optimisticStates, setOptimisticStates] = useState({});
  const [quickActionMenu, setQuickActionMenu] = useState(null);
  const pressTimer = useRef(null);
  const isLongPress = useRef(false);
  const calendarRef = useRef(null);

  const tables = useMemo(() => buildTables(config), [config]);
  const slots  = useMemo(() => genSlots(service), [service]);

  // ── Online/Offline indicator ───────────────────────────────────────────────
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ── Corregir currentTime si cambia de servicio ─────────────────────────────
  useEffect(() => {
    if (!slots.includes(currentTime)) setCurrentTime(slots[Math.floor(slots.length / 2)]);
  }, [service]);

  // ── Cargar configuración del restaurante desde Firestore ───────────────────
  useEffect(() => {
    const unsub = onSnapshot(cfgRef(), (snap) => {
      if (snap.exists()) setConfig(snap.data());
    });
    return unsub;
  }, []);

  // ── Escucha en tiempo real de reservas para la fecha seleccionada ──────────
  useEffect(() => {
    const unsub = onSnapshot(
      resCol(date),
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setReservations(data);
      },
      (err) => { console.error('[Andi] Firestore error:', err); }
    );
    return unsub;
  }, [date]);

  // ── Fetch analytics data para semana/mes ─────────────────────────────────────
  useEffect(() => {
    if (!showAnalytics || analyticsPeriod === 'day') { setAnalyticsRes([]); return; }
    const days = analyticsPeriod === 'week' ? 7 : 30;
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(date + 'T12:00:00');
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    (async () => {
      const all = [];
      for (const d of dates) {
        const snap = await getDocs(resCol(d));
        snap.docs.forEach(doc => all.push({ id: doc.id, ...doc.data() }));
      }
      setAnalyticsRes(all);
    })();
  }, [showAnalytics, analyticsPeriod, date]);

  // ── Persistir configuración ────────────────────────────────────────────────
  const saveConfig = useCallback(async (c) => {
    setConfig(c);
    try { await setDoc(cfgRef(), c, { merge: true }); } catch (e) { console.error(e); }
  }, []);

  // ── CRUD de reservas ───────────────────────────────────────────────────────
  const saveRes = useCallback(async (data) => {
    const id = data.id || `r${Date.now()}`;
    try {
      await setDoc(resDocRef(date, id), {
        ...data,
        id,
        liveState: data.liveState || null,
        updatedAt: serverTimestamp(),
        createdAt: data.createdAt || serverTimestamp(),
      });

      // Notificación silenciosa en segundo plano
      // Fix: usar `date` en lugar de `targetDate` (variable inexistente)
      notificarN8N({
        cliente_nombre: data.customerName,
        telefono: data.phone || '',
        cantidad_personas: data.partySize,
        fecha: date,
        hora: data.time || ''
      });
    } catch (e) {
      console.error('[Andi] Error crítico en setDoc:', e);
      throw e;
    }
  }, [date]);

  const deleteRes = useCallback(async (id) => {
    try { await deleteDoc(resDocRef(date, id)); } catch (e) { console.error(e); }
  }, [date]);

  // ── Actualizar solo el estado en vivo de una reserva ──────────────────────
  const updateLiveState = useCallback(async (res, liveState) => {
    setShowLiveMenu(null);
    setOptimisticStates(prev => ({ ...prev, [res.id]: liveState }));
    try {
      const patch = { liveState, updatedAt: serverTimestamp() };
      if (liveState === 'comiendo_entrada' && !res.seatedAt) patch.seatedAt = serverTimestamp();
      if (liveState === 'para_limpiar') patch.leftAt = serverTimestamp();
      await setDoc(resDocRef(date, res.id), patch, { merge: true });
      setOptimisticStates(prev => { const n = {...prev}; delete n[res.id]; return n; });
    } catch (e) { 
      console.warn('[Andi] Fallo en la actualización optimista, revirtiendo estado...', e);
      setOptimisticStates(prev => { const n = {...prev}; delete n[res.id]; return n; });
    }
  }, [date]);

  const finalizeReservation = useCallback(async (res) => {
    setQuickActionMenu(null);
    setShowLiveMenu(null);
    setOptimisticStates(prev => ({ ...prev, [res.id]: 'finalizada' }));

    const toMs = (ts) => {
      if (!ts) return Date.now();
      if (typeof ts === 'number') return ts;
      if (ts.toMillis) return ts.toMillis();
      if (ts.seconds) return ts.seconds * 1000;
      return new Date(ts).getTime();
    };
    
    const startTs = toMs(res.seatedAt || res.createdAt);
    const duracionMinutos = Math.round((Date.now() - startTs) / 60000);
    const tableName = tables.find(t => t.id === res.tableId)?.name || res.tableId;

    notificarN8N({
      evento: 'reserva_finalizada',
      cliente_nombre: res.customerName,
      mesa: tableName,
      duracion_total_minutos: duracionMinutos
    });

    try {
      await setDoc(resDocRef(date, res.id), {
        liveState: 'finalizada',
        endTime: serverTimestamp(),
        duracion_total_minutos: duracionMinutos,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setOptimisticStates(prev => { const n = {...prev}; delete n[res.id]; return n; });
    } catch (e) { 
      console.warn('[Andi] Fallo al finalizar reserva, revirtiendo estado...', e);
      setOptimisticStates(prev => { const n = {...prev}; delete n[res.id]; return n; });
    }
  }, [date, tables]);

  // ── Cálculos ───────────────────────────────────────────────────────────────
  const nowMin  = t2m(currentTime, service);
  const svcRes  = reservations
    .map(r => optimisticStates[r.id] !== undefined ? { ...r, liveState: optimisticStates[r.id] } : r)
    .filter(r => r.service === service);

  const tableStatus = useCallback((id) => {
    const tableRes = svcRes.filter(r => r.tableId === id && r.liveState !== 'finalizada');
    if (tableRes.length === 0) return { status: 'free' };

    const cleaning = tableRes.find(r => r.liveState === 'para_limpiar');
    if (cleaning) return { status: 'soon', res: cleaning };

    const active = tableRes.find(r => r.liveState && r.liveState !== 'para_limpiar');
    if (active) return { status: 'busy', res: active };

    const pending = tableRes.find(r => !r.liveState);
    if (pending) return { status: 'reserved', res: pending };

    return { status: 'free' };
  }, [svcRes]);

  const stats = useMemo(() => {
    let free = 0, busy = 0, soon = 0, reserved = 0, seatsBusy = 0;
    tables.forEach(t => {
      const s = tableStatus(t.id);
      if (s.status === 'free')        free++;
      else if (s.status === 'reserved') reserved++;
      else if (s.status === 'busy')  { busy++; seatsBusy += (s.res.partySize || 0); }
      else                             soon++;
    });
    return { free, busy, soon, reserved, seatsBusy };
  }, [tables, tableStatus]);

  const analyticsData = useMemo(() => {
    const src = analyticsPeriod === 'day' ? reservations : analyticsRes;

    const toMin = (ts) => {
      if (!ts) return null;
      if (typeof ts === 'number') return ts > 1e6 ? ts / 60000 : ts;
      if (ts.seconds != null) return ts.seconds / 60 + (ts.nanoseconds || 0) / 6e10;
      if (ts.toDate) return ts.toDate().getTime() / 60000;
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d.getTime() / 60000;
    };

    const active = src.filter(r => r.seatedAt || r.liveState);

    const stays = active.map(r => {
      const start = toMin(r.seatedAt) || t2m(r.time, r.service);
      if (start == null) return null;
      const end = r.leftAt ? toMin(r.leftAt) : null;
      const stayMin = end != null ? Math.round(end - start) : null;
      return { ...r, stayMin };
    }).filter(Boolean);

    const withDuration = stays.filter(r => r.stayMin != null && r.stayMin >= 0 && r.stayMin <= 600);
    const totalCustomers = active.reduce((s, r) => s + (r.partySize || 0), 0);
    const avgStay = withDuration.length > 0
      ? Math.round(withDuration.reduce((s, r) => s + r.stayMin, 0) / withDuration.length)
      : 0;

    return { totalCustomers, avgStay };
  }, [reservations, analyticsRes, analyticsPeriod, service]);

  const sortedRes = useMemo(() =>
    [...svcRes].sort((a, b) => t2m(a.time, a.service) - t2m(b.time, b.service)),
  [svcRes]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSave = useCallback((data) => {
    saveRes({ ...data, duration: data.duration || SERVICES[service].defaultDuration, service, date });
    setShowModal(false); setEditing(null); setPreTable(null);
  }, [saveRes, service, date]);

  const handleDelete = useCallback((id) => {
    deleteRes(id);
    setShowModal(false); setEditing(null);
  }, [deleteRes]);

  const goNow = () => {
    setDate(todayISO());
    const s = detectService();
    setService(s);
    setCurrentTime(detectTime(s));
  };

  const shiftDate = (days) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.cream, color: C.espresso, fontFamily: '"Manrope", system-ui, sans-serif', paddingBottom: '120px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Manrope:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input, select, textarea { font-family: inherit; }
        input[type="range"] { -webkit-appearance: none; appearance: none; height: 6px; background: ${C.creamDeep}; border-radius: 3px; outline: none; touch-action: pan-x; -webkit-tap-highlight-color: transparent; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 28px; height: 28px; background: ${C.terra}; border-radius: 50%; cursor: pointer; box-shadow: 0 2px 6px rgba(196,96,47,0.4); touch-action: none; }
        input[type="range"]::-moz-range-thumb { width: 28px; height: 28px; background: ${C.terra}; border-radius: 50%; cursor: pointer; border: none; touch-action: none; }
        button:active { transform: scale(0.97); }
        button { transition: transform 0.1s; }
        .live-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 5px; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{ background: C.forest, color: C.cream, padding: '24px 20px 28px', borderBottomLeftRadius: '28px', borderBottomRightRadius: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', opacity: 0.55, margin: 0 }}>Recepción</p>
            <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: '34px', fontStyle: 'italic', fontWeight: 600, margin: '2px 0 0', lineHeight: 1, letterSpacing: '-0.02em' }}>Andi</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Indicador online/offline */}
            <div title={online ? 'Conectado' : 'Sin conexión — cambios en cola'} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: '10px', fontSize: '11px' }}>
              {online
                ? <><Wifi size={13} color="#6fd98d" /><span style={{ color: '#6fd98d' }}>Online</span></>
                : <><WifiOff size={13} color={C.soon} /><span style={{ color: C.soon }}>Offline</span></>
              }
            </div>
            <button onClick={() => setShowAnalytics(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
              <BarChart3 size={18} />
            </button>
            <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Navegación de fecha */}
        <div ref={calendarRef} style={{ position: 'relative', width: '100%' }}>
          <button onClick={() => setShowCalendar(!showCalendar)} style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '12px', color: C.cream, fontSize: '15px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>{formatDate(date)}</span>
          </button>

          {showCalendar && (
            <CalendarPicker
              date={date}
              onSelect={(d) => { setDate(d); setShowCalendar(false); }}
              onClose={() => setShowCalendar(false)}
              colors={C}
            />
          )}
        </div>
      </header>

      {/* ── SELECTOR DE SERVICIO ── */}
      <div style={{ padding: '20px 16px 8px', display: 'flex', gap: '8px' }}>
        {Object.entries(SERVICES).map(([k, s]) => {
          const Icon   = s.icon;
          const active = service === k;
          return (
            <button key={k} onClick={() => setService(k)} style={{
              flex: 1, padding: '14px 8px',
              background: active ? C.forest : 'transparent',
              color: active ? C.cream : C.forest,
              border: `1.5px solid ${C.forest}`,
              borderRadius: '14px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600 }}>
                <Icon size={14} />{s.name}
              </div>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>{s.start} — {s.end}</span>
            </button>
          );
        })}
      </div>

      {/* ── SLIDER DE TIEMPO ── */}
      <div style={{ padding: '12px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
          <span style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.muted, fontWeight: 600 }}>Viendo a las</span>
          <div style={{ fontFamily: '"Fraunces", serif', fontSize: '40px', fontWeight: 700, color: C.forest, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {currentTime}
          </div>
        </div>
        <input type="range" min={0} max={slots.length - 1} step={1}
          value={Math.max(0, slots.indexOf(currentTime))}
          onChange={(e) => setCurrentTime(slots[parseInt(e.target.value)])}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: C.muted, marginTop: '4px' }}>
          <span>{SERVICES[service].start}</span>
          <span style={{ opacity: 0.5 }}>cada 15 min</span>
          <span>{SERVICES[service].end}</span>
        </div>
      </div>

      {/* ── STATS ── */}
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: '8px' }}>
        <Stat color={C.free}  label="Libres"   value={stats.free}  />
        <Stat color={C.terra} label="Ocupadas" value={stats.busy}  />
        <Stat color={C.forestSoft} label="Próximas" value={stats.reserved}  />
        <Stat color={C.soon}  label="A limpiar" value={stats.soon}  />
      </div>

      {/* ── TABS: MESAS / RESERVAS ── */}
      <div style={{ padding: '0 16px', display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {[['mesas', 'Mesas', `${tables.length} mesas`], ['reservas', 'Reservas', `${sortedRes.length} items`]].map(([key, label, sub]) => (
          <button key={key} onClick={() => setMainTab(key)} style={{
            flex: 1, padding: '10px 12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
            background: mainTab === key ? C.forest : C.creamDeep,
            color: mainTab === key ? C.cream : C.muted,
            fontFamily: 'inherit', textAlign: 'left',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '1px' }}>{sub}</div>
          </button>
        ))}
      </div>

      {/* ── GRILLA DE MESAS ── */}
      {mainTab === 'mesas' && (
        <div style={{ padding: '0 16px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
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
                <button 
                  key={t.id} 
                  onContextMenu={(e) => {
                    if (s.status !== 'free') e.preventDefault();
                  }}
                  onClick={(e) => {
                    if (isLongPress.current) { isLongPress.current = false; return; }
                    if (s.status === 'free') {
                      setPreTable(t); setEditing(null); setShowModal(true);
                    } else if (s.status === 'reserved') {
                      setEditing(s.res); setShowModal(true);
                    } else {
                      setShowLiveMenu(s.res);
                    }
                  }}
                  onTouchStart={(e) => {
                    if (s.status === 'free') return;
                    isLongPress.current = false;
                    const res = s.res;
                    const rect = e.currentTarget.getBoundingClientRect();
                    pressTimer.current = setTimeout(() => {
                      isLongPress.current = true;
                      setQuickActionMenu({ res, rect });
                    }, 400);
                  }}
                  onTouchEnd={() => { if (pressTimer.current) clearTimeout(pressTimer.current); }}
                  onMouseDown={(e) => {
                    if (s.status === 'free') return;
                    isLongPress.current = false;
                    const res = s.res;
                    const rect = e.currentTarget.getBoundingClientRect();
                    pressTimer.current = setTimeout(() => {
                      isLongPress.current = true;
                      setQuickActionMenu({ res, rect });
                    }, 400);
                  }}
                  onMouseUp={() => { if (pressTimer.current) clearTimeout(pressTimer.current); }}
                  onMouseLeave={() => { if (pressTimer.current) clearTimeout(pressTimer.current); }}
                  style={{
                  aspectRatio: '1', background: bg, color: fg,
                  border: `1.5px solid ${border}`, borderRadius: '14px',
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
      )}

      {/* ── LISTADO DE RESERVAS ── */}
      {mainTab === 'reservas' && (
        <div style={{ padding: '0 16px 24px' }}>
          {sortedRes.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted, background: C.creamDeep, borderRadius: '14px', fontSize: '13px' }}>
              Sin reservas para este servicio
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedRes.map(r => {
                const table   = tables.find(t => t.id === r.tableId);
                const started = r.liveState && r.liveState !== 'para_limpiar';
                const isDone  = r.liveState === 'para_limpiar';
                const live    = started ? LIVE_STATES[r.liveState] : null;
                const badgeLabel = started ? live.label : 'Próxima';
                const badgeColor = started ? live.color : C.forestSoft;
                return (
                  <button key={r.id} onClick={() => { setEditing(r); setShowModal(true); }} style={{
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
                      </div>
                      {r.notes && <div style={{ fontSize: '11px', color: C.terra, marginTop: '3px', fontStyle: 'italic' }}>{r.notes}</div>}
                    </div>
                    {!isDone && (
                    <button onClick={(e) => {
                      e.stopPropagation();
                      setShowLiveMenu(r);
                    }} style={{
                      flexShrink: 0, background: badgeColor,
                      border: 'none', borderRadius: '10px', padding: '6px 8px',
                      cursor: 'pointer', color: C.white,
                      fontSize: '10px', fontWeight: 600, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: '2px', minWidth: '52px',
                    }}>
                      {started ? <RefreshCw size={12} /> : <span style={{ fontSize: '14px' }}>▶</span>}
                      <span>{badgeLabel}</span>
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* ── FAB: Nueva reserva ── */}
      <button onClick={() => { setEditing(null); setPreTable(null); setShowModal(true); }} style={{
        position: 'fixed', bottom: '24px', right: '24px',
        width: '60px', height: '60px', borderRadius: '30px',
        background: C.terra, color: '#fff', border: 'none',
        boxShadow: '0 8px 24px rgba(196,96,47,0.4)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}>
        <Plus size={26} />
      </button>

      {/* ── MODAL: Estado en vivo ── */}
      {showLiveMenu && (
        <LiveStateModal
          res={showLiveMenu}
          tables={tables}
          onSelect={(state) => updateLiveState(showLiveMenu, state)}
          onEdit={() => { setEditing(showLiveMenu); setShowLiveMenu(null); setShowModal(true); }}
          onClose={() => setShowLiveMenu(null)}
          onFinalize={() => finalizeReservation(showLiveMenu)}
        />
      )}

      {/* ── MODAL: Reserva ── */}
      {showModal && (
        <ResModal
          editing={editing}
          preTable={preTable}
          tables={tables}
          slots={slots}
          service={service}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setShowModal(false); setEditing(null); setPreTable(null); }}
        />
      )}

      {/* ── MODAL: Configuración ── */}
      {showSettings && (
        <SettingsModal
          config={config}
          onSave={saveConfig}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ── MODAL: Analíticas ── */}
      {showAnalytics && (
        <AnalyticsPanel
          data={analyticsData}
          period={analyticsPeriod}
          onPeriodChange={setAnalyticsPeriod}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {/* ── MENU CONTEXTUAL RÁPIDO (LONG PRESS) ── */}
      {quickActionMenu && (() => {
        const getNextStates = (current) => {
          if (!current) return ['esperando_cliente', 'comiendo_entrada'];
          if (current === 'esperando_cliente') return ['comiendo_entrada'];
          if (current === 'comiendo_entrada') return ['plato_principal'];
          if (current === 'plato_principal') return ['en_postre_cafe'];
          if (current === 'en_postre_cafe') return ['esperando_cuenta', 'para_limpiar'];
          if (current === 'esperando_cuenta') return ['para_limpiar'];
          if (current === 'para_limpiar') return ['finalizar'];
          return [];
        };
        const nextStates = getNextStates(quickActionMenu.res.liveState);
        return (
          <>
            <div 
              style={{ position: 'fixed', inset: 0, zIndex: 40 }} 
              onClick={(e) => { e.stopPropagation(); setQuickActionMenu(null); }}
              onTouchStart={(e) => { e.stopPropagation(); setQuickActionMenu(null); }}
            />
            <div style={{
              position: 'fixed', zIndex: 50,
              top: `${quickActionMenu.rect.top}px`, left: `${quickActionMenu.rect.left + quickActionMenu.rect.width / 2}px`,
              transform: 'translate(-50%, -100%)',
              marginTop: '-10px',
              background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)',
              border: `1px solid ${C.creamDeep}`, borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '6px',
              display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px'
            }}>
              {nextStates.map(stateKey => {
                if (stateKey === 'finalizar') {
                  return (
                    <button key="finalizar" onClick={() => finalizeReservation(quickActionMenu.res)} style={{
                      background: C.free, color: '#fff', border: 'none', padding: '10px 12px',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer', borderRadius: '8px', textAlign: 'center'
                    }}>
                      Finalizar
                    </button>
                  );
                }
                const stateObj = LIVE_STATES[stateKey];
                return (
                  <button key={stateKey} onClick={() => updateLiveState(quickActionMenu.res, stateKey)} style={{
                    background: 'transparent', border: 'none', padding: '10px 12px',
                    fontSize: '13px', fontWeight: 600, color: stateObj.color,
                    cursor: 'pointer', textAlign: 'center', borderRadius: '8px',
                  }}>
                    {stateObj.label}
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LiveStateModal — Selector de estado en vivo para mozos
// ═══════════════════════════════════════════════════════════════════════════════
function LiveStateModal({ res, tables, onSelect, onEdit, onClose, onFinalize }) {
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
        <button onClick={onClose} style={{ padding: '12px 20px', background: C.forest, border: 'none', borderRadius: '12px', cursor: 'pointer', color: C.cream, fontSize: '13px' }}>
          Cerrar
        </button>
      </div>
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ResModal — Modal de creación / edición de reserva
// ═══════════════════════════════════════════════════════════════════════════════
function ResModal({ editing, preTable, tables, slots, service, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(() => editing ? { ...editing } : {
    customerName: '', phone: '', partySize: 2,
    tableId: preTable?.id || '',
    time: slots[Math.floor(slots.length / 3)] || slots[0],
    notes: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const valid = form.customerName.trim() && form.tableId && form.time && form.partySize > 0;

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>
          {editing ? 'Editar reserva' : 'Nueva reserva'}
        </h3>
        <button onClick={onClose} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: C.muted }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="Nombre">
          <input value={form.customerName} onChange={e => set('customerName', e.target.value)}
            placeholder="Nombre del cliente" style={inp} autoFocus />
        </Field>

        <Field label="Teléfono (opcional)">
          <input value={form.phone} onChange={e => set('phone', e.target.value)}
            placeholder="+54 9 11 ..." type="tel" style={inp} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Comensales">
            <select value={form.partySize} onChange={e => set('partySize', parseInt(e.target.value))} style={inp}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n} personas</option>)}
            </select>
          </Field>
          <Field label="Mesa">
            <select value={form.tableId} onChange={e => set('tableId', e.target.value)} style={inp}>
              <option value="">— elegir —</option>
              {tables.map(t => <option key={t.id} value={t.id}>{t.name} ({t.capacity}p)</option>)}
            </select>
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          <Field label="Horario">
            <select value={form.time} onChange={e => set('time', e.target.value)} style={inp}>
              {slots.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Notas (opcional)">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Alergias, pedidos especiales..." rows={2}
            style={{ ...inp, resize: 'vertical' }} />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        {editing && (
          <button onClick={() => onDelete(editing.id)} style={{
            padding: '14px', background: 'transparent', border: `1.5px solid #e06060`,
            borderRadius: '12px', cursor: 'pointer', color: '#e06060',
          }}>
            <Trash2 size={18} />
          </button>
        )}
        <button onClick={() => valid && onSave({ ...form, service })} style={{
          flex: 1, padding: '14px', background: valid ? C.terra : C.creamDeep,
          border: 'none', borderRadius: '12px', cursor: valid ? 'pointer' : 'not-allowed',
          color: valid ? C.white : C.muted, fontSize: '15px', fontWeight: 600,
        }}>
          {editing ? 'Guardar cambios' : 'Confirmar reserva'}
        </button>
      </div>
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SettingsModal — Configuración del restaurante
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsModal({ config, onSave, onClose }) {
  const [local, setLocal] = useState({ ...config });
  const set = (k, v) => setLocal(l => ({ ...l, [k]: v }));
  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>Configuración</h3>
        <button onClick={onClose} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
      </div>
      <p style={{ fontSize: '12px', color: C.muted, marginBottom: '16px' }}>Cantidad de mesas por capacidad. Los cambios se sincronizan a todos los dispositivos.</p>
      {[['cap2','Mesas de 2'],['cap4','Mesas de 4'],['cap5','Mesas de 5'],['cap8','Mesas de 8']].map(([k, label]) => (
        <Counter key={k} label={label} value={local[k] || 0} onChange={v => set(k, v)} />
      ))}
      <button onClick={() => { onSave(local); onClose(); }} style={{
        width: '100%', marginTop: '20px', padding: '14px',
        background: C.forest, border: 'none', borderRadius: '12px',
        cursor: 'pointer', color: C.cream, fontSize: '15px', fontWeight: 600,
      }}>Guardar configuración</button>
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CalendarPicker — Calendario desplegable centrado
// ═══════════════════════════════════════════════════════════════════════════════
function CalendarPicker({ date, onSelect, onClose, colors: C }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(date + 'T12:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
  const startDay = new Date(viewDate.year, viewDate.month, 1).getDay();
  const today = new Date();

  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const weekdays = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];

  const prev = () => setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  const next = () => setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const sel = iso === date;
    const isToday = viewDate.year === today.getFullYear() && viewDate.month === today.getMonth() && d === today.getDate();
    cells.push(
      <button key={d} onClick={() => onSelect(iso)} style={{
        aspectRatio: '1', borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: sel ? C.terra : isToday ? 'rgba(196,96,47,0.15)' : 'transparent',
        color: sel ? '#fff' : C.espresso,
        fontWeight: sel ? 700 : isToday ? 600 : 400,
        fontSize: '14px', fontFamily: 'inherit',
      }}>{d}</button>
    );
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
      background: C.white, borderRadius: '16px', boxShadow: '0 8px 32px rgba(31,58,46,0.2)',
      padding: '16px', width: '300px', zIndex: 300,
    }}>
      {/* Header del mes */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={prev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.espresso, padding: '4px' }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontFamily: '"Fraunces", serif', fontSize: '18px', fontStyle: 'italic', fontWeight: 600, color: C.forest }}>
          {months[viewDate.month]} {viewDate.year}
        </span>
        <button onClick={next} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.espresso, padding: '4px' }}>
          <ChevronRight size={18} />
        </button>
      </div>
      {/* Días de la semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {weekdays.map(w => (
          <div key={w} style={{ textAlign: 'center', fontSize: '11px', color: C.muted, fontWeight: 600, padding: '4px 0' }}>{w}</div>
        ))}
      </div>
      {/* Grid de días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells}
      </div>
      {/* Botón Hoy */}
      <button onClick={() => {
        const d = new Date();
        onSelect(d.toISOString().slice(0, 10));
      }} style={{
        width: '100%', marginTop: '10px', padding: '8px', borderRadius: '10px',
        background: C.creamDeep, border: 'none', cursor: 'pointer',
        color: C.forest, fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
      }}>Hoy</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Subcomponentes
// ═══════════════════════════════════════════════════════════════════════════════
function AnalyticsPanel({ data, period, onPeriodChange, onClose }) {
  const { totalCustomers, avgStay } = data;
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, background: C.white, border: `1.5px solid ${C.creamDeep}`, borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontFamily: '"Fraunces", serif', fontSize: '32px', fontWeight: 700, color: C.terra, lineHeight: 1 }}>{totalCustomers}</div>
            <div style={{ fontSize: '11px', color: C.muted, marginTop: '6px', letterSpacing: '0.05em' }}>Clientes</div>
          </div>
          <div style={{ flex: 1, background: C.white, border: `1.5px solid ${C.creamDeep}`, borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontFamily: '"Fraunces", serif', fontSize: '32px', fontWeight: 700, color: C.forest, lineHeight: 1 }}>{fmtMin(avgStay)}</div>
            <div style={{ fontSize: '11px', color: C.muted, marginTop: '6px', letterSpacing: '0.05em' }}>Perm. promedio</div>
          </div>
        </div>
      )}
    </Overlay>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(31,58,46,0.5)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 200, padding: '16px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: '24px',
        padding: '28px 20px 40px', width: '100%', maxWidth: '480px',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  );
}

function Stat({ color, label, value }) {
  return (
    <div style={{ flex: 1, background: C.white, border: `1.5px solid ${C.creamDeep}`, borderRadius: '14px', padding: '12px', textAlign: 'center' }}>
      <div style={{ fontFamily: '"Fraunces", serif', fontSize: '28px', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '10px', color: C.muted, marginTop: '4px', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

function Counter({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${C.creamDeep}` }}>
      <span style={{ fontSize: '14px', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => onChange(Math.max(0, value - 1))} style={{ width: '32px', height: '32px', borderRadius: '50%', background: C.creamDeep, border: 'none', cursor: 'pointer', fontSize: '18px', color: C.espresso }}>−</button>
        <span style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontWeight: 600, color: C.forest, minWidth: '28px', textAlign: 'center' }}>{value}</span>
        <button onClick={() => onChange(value + 1)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: C.terra, border: 'none', cursor: 'pointer', fontSize: '18px', color: '#fff' }}>+</button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );
}

const inp = {
  width: '100%', padding: '12px 14px', fontSize: '16px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '12px', color: C.espresso, outline: 'none',
};
