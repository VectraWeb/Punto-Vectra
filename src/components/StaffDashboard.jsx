import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus, Users, Phone, X, Trash2, Settings, Sun, Moon,
  ChevronLeft, ChevronRight, Clock, Wifi, WifiOff, RefreshCw, BarChart3,
  LogOut, User, UserPlus, ToggleLeft, ToggleRight,
} from 'lucide-react';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDocs,
  serverTimestamp, query, where, runTransaction, arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import { seedMesasIfNeeded, subscribeMesas, syncMesasWithConfig } from '../services/mesasHelpers';
import SalonFloor from './SalonFloor';
import LiveStateModal from './LiveStateModal';
import ResModal from './ResModal';
import SettingsModal from './SettingsModal';
import StaffModal from './StaffModal';
import SectoresModal from './SectoresModal';
import CalendarPicker from './CalendarPicker';
import {
  C, LIVE_STATES, SERVICES, DEFAULT_CONFIG,
  t2m, m2t, genSlots, buildTables, todayISO, formatDate,
  detectService, detectTime, notificarN8N, computeStateDurations,
} from '../utils';

// ─── Firestore helpers ───────────────────────────────────────────────────────
const resCol = () => collection(db, 'reservations');
const resDocRef = (id) => doc(db, 'reservations', id);
const mesaReservadaRef = (tableId, date, service) =>
  doc(db, 'mesasReservadas', `${tableId}_${date}_${service}`);
const cfgRef = () => doc(db, 'config', 'restaurant');
const staffCol = () => collection(db, 'staff');
const staffDoc = (id) => doc(db, 'staff', id);

// ═══════════════════════════════════════════════════════════════════════════════
// StaffDashboard — Dashboard completo para mozos (antes era App)
// ═══════════════════════════════════════════════════════════════════════════════
export default function StaffDashboard({ onLogout }) {
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayISO);
  const [service, setService] = useState(detectService);
  const [currentTime, setCurrentTime] = useState(() => detectTime(detectService()));
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [reservations, setReservations] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preTable, setPreTable] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showLiveMenu, setShowLiveMenu] = useState(null); // reserva seleccionada para cambiar estado
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('day');
  const [analyticsRes, setAnalyticsRes] = useState([]);
  const [mainTab, setMainTab] = useState('mesas');
  const [editingLayout, setEditingLayout] = useState(false);
  const [optimisticStates, setOptimisticStates] = useState({});
  const [quickActionMenu, setQuickActionMenu] = useState(null);
  const [staff, setStaff] = useState([]);
  const [showStaff, setShowStaff] = useState(false);
  const [showSectors, setShowSectors] = useState(false);
  const [editingSectors, setEditingSectors] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const deferredPrompt = useRef(null);
  const [canInstall, setCanInstall] = useState(false);
  const pressTimer = useRef(null);
  const isLongPress = useRef(false);
  const calendarRef = useRef(null);
  const configLoaded = useRef(false);

  const tables = useMemo(() => {
    if (mesas.length > 0) return mesas;
    return buildTables(config);
  }, [mesas, config]);
  const slots = useMemo(() => genSlots(service), [service]);

  // ── Loading state ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!configLoaded.current && config !== DEFAULT_CONFIG) {
      configLoaded.current = true;
      setLoading(false);
    }
    const timer = setTimeout(() => {
      setLoading(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [config]);

  // ── Capturar prompt de instalación PWA ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); deferredPrompt.current = e; setCanInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') setCanInstall(false);
    deferredPrompt.current = null;
  }, []);

  // ── Online/Offline indicator ───────────────────────────────────────────────
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
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

  // ── Sembrar colección mesas si no existe + escucharla ────────────────────
  useEffect(() => { seedMesasIfNeeded(config); }, [config]);
  useEffect(() => {
    const unsub = subscribeMesas(setMesas);
    return unsub;
  }, []);

  // ── Escucha en tiempo real de reservas para la fecha seleccionada ──────────
  useEffect(() => {
    const q = query(resCol(), where('date', '==', date));
    const unsub = onSnapshot(
      q,
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
      const snap = await getDocs(query(resCol(), where('date', 'in', dates)));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAnalyticsRes(all);
    })();
  }, [showAnalytics, analyticsPeriod, date]);

  // ── Escucha en tiempo real del personal ──────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(staffCol(), (snap) => {
      setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // ── Limpiar sectores al cambiar de día ────────────────────────────────────
  const lastDateRef = useRef(date);
  useEffect(() => {
    if (lastDateRef.current !== date && config.sectors?.length > 0) {
      saveConfig({ ...config, sectors: [] });
    }
    lastDateRef.current = date;
  }, [date]);

  // ── Persistir configuración ────────────────────────────────────────────────
  const saveConfig = useCallback(async (c) => {
    setConfig(c);
    try {
      await setDoc(cfgRef(), c, { merge: true });
      await syncMesasWithConfig(c);
    } catch (e) { console.error(e); }
  }, []);

  // ── CRUD de reservas ───────────────────────────────────────────────────────
  const saveRes = useCallback(async (data) => {
    const id = data.id || `r${Date.now()}`;
    const { _oldMesaRef, _prevResId, _prevMesaRef, ...cleanData } = data;

    if (!cleanData.tableId) {
      await setDoc(resDocRef(id), {
        ...cleanData, id, date,
        mesa_id: null,
        estado: 'pendiente',
        updatedAt: serverTimestamp(),
        createdAt: cleanData.createdAt || serverTimestamp(),
      });
      return;
    }

    const mesaRef = mesaReservadaRef(cleanData.tableId, date, cleanData.service);

      try {
        await runTransaction(db, async (transaction) => {
          const mesaSnap = await transaction.get(mesaRef);

          if (_prevResId) {
            transaction.delete(resDocRef(_prevResId));
            if (_prevMesaRef) transaction.delete(_prevMesaRef);
          }

          if (mesaSnap.exists()) {
            const mesaData = mesaSnap.data();
            if (mesaData.reservationId !== id && mesaData.reservationId !== _prevResId) {
              throw new Error('Lo sentimos, esa mesa acaba de ser reservada por otro usuario.');
            }
          }

          if (_oldMesaRef) transaction.delete(_oldMesaRef);

          transaction.set(mesaRef, { occupied: true, reservationId: id, time: cleanData.time, partySize: cleanData.partySize });
          transaction.set(resDocRef(id), {
            ...cleanData, id, date,
            mesa_id: cleanData.tableId,
            estado: cleanData.tableId ? (cleanData.estado || 'confirmada') : 'pendiente',
            liveState: cleanData.liveState || null,
            updatedAt: serverTimestamp(),
            createdAt: cleanData.createdAt || serverTimestamp(),
          });
        });
      } catch (e) { throw e; }
  }, [date]);

  const deleteRes = useCallback(async (resData) => {
    if (!resData.tableId) {
      await deleteDoc(resDocRef(resData.id));
      return;
    }
    const mesaRef = mesaReservadaRef(resData.tableId, date, resData.service);
    try {
      await runTransaction(db, async (transaction) => {
        transaction.delete(mesaRef);
        transaction.delete(resDocRef(resData.id));
      });
    } catch (e) { console.error(e); throw e; }
  }, [date]);

  // ── Actualizar solo el estado en vivo de una reserva ──────────────────────
  const updateLiveState = useCallback(async (res, liveState) => {
    setShowLiveMenu(null);
    setOptimisticStates(prev => ({ ...prev, [res.id]: liveState }));
    try {
      const patch = {
        liveState,
        updatedAt: serverTimestamp(),
      };
      if (liveState === 'esperando_cliente' && !res.startedAt) patch.startedAt = serverTimestamp();
      if (liveState === 'para_limpiar') patch.leftAt = serverTimestamp();
      await updateDoc(resDocRef(res.id), patch);
      updateDoc(resDocRef(res.id), {
        stateLog: arrayUnion({ state: liveState, at: serverTimestamp() }),
      }).catch(err => console.warn('[Andi] Fallo al registrar stateLog:', err));
      setOptimisticStates(prev => { const n = { ...prev }; delete n[res.id]; return n; });
    } catch (e) {
      console.warn('[Andi] Fallo en la actualización optimista, revirtiendo estado...', e);
      setOptimisticStates(prev => { const n = { ...prev }; delete n[res.id]; return n; });
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

    const startTs = toMs(res.startedAt || res.createdAt);
    const duracionMinutos = Math.round((Date.now() - startTs) / 60000);
    const tableName = tables.find(t => t.id === res.tableId)?.name || res.tableId;

    notificarN8N({
      evento: 'reserva_finalizada',
      cliente_nombre: res.customerName,
      mesa: tableName,
      mesa_id: res.tableId,
      servicio: res.service,
      duracion_total_minutos: duracionMinutos
    });

    try {
      if (res.tableId) {
        await deleteDoc(mesaReservadaRef(res.tableId, date, res.service));
      }
      await updateDoc(resDocRef(res.id), {
        liveState: 'finalizado',
        leftAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      updateDoc(resDocRef(res.id), {
        stateLog: arrayUnion({ state: 'finalizado', at: serverTimestamp() }),
      }).catch(err => console.warn('[Andi] Fallo al registrar stateLog:', err));
      setOptimisticStates(prev => { const n = { ...prev }; delete n[res.id]; return n; });
    } catch (e) {
      console.warn('[Andi] Fallo al finalizar reserva, revirtiendo estado...', e);
      setOptimisticStates(prev => { const n = { ...prev }; delete n[res.id]; return n; });
    }
  }, [date, tables]);

  // ── Resetear estado en vivo (Limpiar mesa) ──────────────────────────────
  const resetLiveState = useCallback(async (res) => {
    setShowLiveMenu(null);
    setOptimisticStates(prev => ({ ...prev, [res.id]: null }));
    try {
      await updateDoc(resDocRef(res.id), {
        liveState: null,
        startedAt: null,
        leftAt: null,
        updatedAt: serverTimestamp(),
      });
      updateDoc(resDocRef(res.id), {
        stateLog: arrayUnion({ state: 'liberada', at: serverTimestamp() }),
      }).catch(err => console.warn('[Andi] Fallo al registrar stateLog:', err));
      setOptimisticStates(prev => { const n = { ...prev }; delete n[res.id]; return n; });
    } catch (e) {
      console.warn('[Andi] Fallo al limpiar mesa, revirtiendo...', e);
      setOptimisticStates(prev => { const n = { ...prev }; delete n[res.id]; return n; });
    }
  }, [date]);

  // ── Cálculos ───────────────────────────────────────────────────────────────
  const nowMin = t2m(currentTime, service);
  const svcRes = reservations
    .map(r => optimisticStates[r.id] !== undefined ? { ...r, liveState: optimisticStates[r.id] } : r)
    .filter(r => r.service === service)
    .filter(r => r.liveState !== 'finalizado');

  const tableStatus = useCallback((id) => {
    const tableRes = svcRes.filter(r => r.tableId === id);
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
      if (s.status === 'free') free++;
      else if (s.status === 'reserved') reserved++;
      else if (s.status === 'busy') { busy++; seatsBusy += (s.res.partySize || 0); }
      else soon++;
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

    const active = src.filter(r => r.startedAt || r.liveState);

    const stays = active.map(r => {
      const start = toMin(r.startedAt) || t2m(r.time, r.service);
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

    // ── stateLog breakdown by partySize ──
    const byPs = {};
    for (const r of src) {
      if (!r.stateLog || !Array.isArray(r.stateLog) || r.stateLog.length < 2) continue;
      const durations = computeStateDurations(r.stateLog);
      if (durations.length === 0) continue;
      const ps = r.partySize || 0;
      if (!byPs[ps]) byPs[ps] = {};
      for (const d of durations) {
        if (!byPs[ps][d.state]) byPs[ps][d.state] = [];
        byPs[ps][d.state].push(d.durationMin);
      }
    }
    const stateBreakdown = {};
    for (const [ps, states] of Object.entries(byPs)) {
      stateBreakdown[ps] = {};
      for (const [state, durs] of Object.entries(states)) {
        stateBreakdown[ps][state] = {
          avg: Math.round(durs.reduce((a, b) => a + b, 0) / durs.length),
          count: durs.length,
        };
      }
    }

    return { totalCustomers, avgStay, stateBreakdown };
  }, [reservations, analyticsRes, analyticsPeriod, service]);

  const sortedRes = useMemo(() =>
    [...svcRes].sort((a, b) => t2m(a.time, a.service) - t2m(b.time, b.service)),
    [svcRes]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (data) => {
    // Validar estado de la mesa antes de guardar
    const s = tableStatus(data.tableId);
    const isCurrentRes = editing && editing.tableId === data.tableId;
    const isAllowed = s.status === 'free' || s.status === 'soon' || isCurrentRes;

    if (!isAllowed) {
      const stateLabel = s.status === 'busy' ? 'Ocupada' : 'Reservada';
      alert(`La mesa no se puede reservar porque su estado actual es "${stateLabel}". Solo se pueden reservar mesas que estén libres o en estado "A limpiar".`);
      return;
    }

    const saveData = { ...data, duration: data.duration || SERVICES[service].defaultDuration, service, date };
    if (editing) {
      saveData._oldMesaRef = mesaReservadaRef(editing.tableId, date, editing.service);
    }

    // Si la mesa está "A limpiar", pasar la reserva anterior para eliminarla en la misma transacción
    if (!editing && s.status === 'soon' && s.res) {
      saveData._prevResId = s.res.id;
      saveData._prevMesaRef = mesaReservadaRef(s.res.tableId, date, s.res.service);
    }

    try {
      await saveRes(saveData);
      setShowModal(false); setEditing(null); setPreTable(null);
    } catch (e) {
      alert(e.message || 'Error al guardar la reserva. Intentá de nuevo.');
    }
  }, [saveRes, service, date, editing, tableStatus]);

  const handleDelete = useCallback(async (resData) => {
    try {
      await deleteRes(resData);
      setShowModal(false); setEditing(null);
    } catch (e) {
      alert('Error al eliminar la reserva. Intentá de nuevo.');
    }
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
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.cream, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div style={{
          width: '48px', height: '48px', border: `4px solid ${C.creamDeep}`,
          borderTopColor: C.terra, borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontFamily: '"Fraunces", serif', fontSize: '20px', fontStyle: 'italic', fontWeight: 600, color: C.forest }}>Cargando Andi...</p>
      </div>
    );
  }

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
        @media (max-width: 480px) {
          .header-btns { display: none !important; }
          .header-menu-btn { display: flex !important; }
          .stat-grid { gap: 4px !important; }
          .tab-grid { font-size: 12px !important; }
          .modal-content { padding: 20px 14px 32px !important; border-radius: 20px !important; }
        }
        @media (min-width: 481px) {
          .header-menu-btn { display: none !important; }
          .mobile-dropdown { display: none !important; }
        }
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
            {/* Desktop: botones individuales */}
            <div className="header-btns" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => setShowAnalytics(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <BarChart3 size={18} />
              </button>
              <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <Settings size={18} />
              </button>
              <button onClick={() => setShowStaff(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <Users size={18} />
              </button>
              <button onClick={() => setShowSectors(true)} title="Sectores del salón" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              </button>
              {canInstall && (
                <button onClick={handleInstall} title="Instalar Andi en tu celular" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  App
                </button>
              )}
              <button onClick={onLogout} title="Salir del panel staff" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <LogOut size={18} />
              </button>
            </div>
            {/* Mobile: menú hamburguesa */}
            <div style={{ position: 'relative' }}>
              <button className="header-menu-btn" onClick={() => setShowMenu(!showMenu)} style={{
                display: 'none', background: 'rgba(255,255,255,0.15)', border: 'none', color: C.cream,
                padding: '10px', borderRadius: '12px', cursor: 'pointer',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              {showMenu && (
                <>
                  <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                  <div className="mobile-dropdown" style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    background: C.forest, borderRadius: '14px', padding: '6px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 200,
                    display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '180px',
                  }}>
                    {[
                      { icon: <BarChart3 size={16} />, label: 'Analíticas', action: () => { setShowAnalytics(true); setShowMenu(false); } },
                      { icon: <Settings size={16} />, label: 'Configuración', action: () => { setShowSettings(true); setShowMenu(false); } },
                      { icon: <Users size={16} />, label: 'Mozos', action: () => { setShowStaff(true); setShowMenu(false); } },
                      { icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>, label: 'Sectores', action: () => { setShowSectors(true); setShowMenu(false); } },
                      ...(canInstall ? [{ icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>, label: 'Instalar App', action: () => { handleInstall(); setShowMenu(false); } }] : []),
                      { icon: <LogOut size={16} />, label: 'Salir', action: () => { onLogout(); setShowMenu(false); } },
                    ].map((item, i) => (
                      <button key={i} onClick={item.action} style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px',
                        background: 'transparent', border: 'none', color: C.cream, borderRadius: '10px',
                        cursor: 'pointer', fontSize: '13px', fontWeight: 500, textAlign: 'left', width: '100%',
                      }}>
                        {item.icon}{item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navegación de fecha */}
        <div ref={calendarRef} style={{ position: 'relative', width: '100%' }}>
          <button onClick={() => setShowCalendar(!showCalendar)} style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '12px', color: C.cream, fontSize: '15px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
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
          const Icon = s.icon;
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

      {/* ── STATS ── */}
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: '8px' }}>
        <Stat color={C.free} label="Libres" value={stats.free} />
        <Stat color={C.terra} label="Ocupadas" value={stats.busy} />
        <Stat color={C.forestSoft} label="Próximas" value={stats.reserved} />
        <Stat color={C.soon} label="A limpiar" value={stats.soon} />
      </div>

      {/* ── TABS: MESAS / RESERVAS / PLANO ── */}
      <div style={{ padding: '0 16px', display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {[['mesas', 'Mesas', `${tables.length} mesas`], ['reservas', 'Reservas', `${sortedRes.length} items`], ['plano', 'Plano', 'Arrastrable']].map(([key, label, sub]) => (
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
                <button key={t.id} onClick={() => {
                  if (s.status === 'free') {
                    setPreTable(t); setEditing(null); setShowModal(true);
                  } else if (s.status === 'reserved') {
                    setShowLiveMenu(s.res);
                  } else {
                    setShowLiveMenu(s.res);
                  }
                }} style={{
                  aspectRatio: t.shape === 'rectangular' ? '2/1' : '1', background: bg, color: fg,
                  border: `1.5px solid ${border}`, borderRadius: t.shape === 'round' ? '50%' : t.shape === 'square' ? '12px' : '10px',
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
                          setShowLiveMenu(r);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setShowLiveMenu(r); } }}
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
          )}
        </div>
      )}

      {/* ── PLANO DEL SALON ── */}
      {mainTab === 'plano' && (
        <SalonFloor
          tables={tables}
          tableStatus={tableStatus}
          isEditing={editingLayout}
          onToggleEdit={() => setEditingLayout(prev => !prev)}
          sectors={config.sectors || []}
          isEditingSectors={editingSectors}
          onToggleEditSectors={() => setEditingSectors(prev => !prev)}
          onSaveSectors={(sectors) => saveConfig({ ...config, sectors })}
          onTableClick={(t, s) => {
            if (editingSectors) return;
            if (s.status === 'free') {
              setPreTable(t); setEditing(null); setShowModal(true);
            } else if (s.status === 'reserved') {
              setShowLiveMenu(s.res);
            } else {
              setShowLiveMenu(s.res);
            }
          }}
        />
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
          onReset={() => resetLiveState(showLiveMenu)}
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
          tableStatus={tableStatus}
          staff={staff}
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

      {/* ── MODAL: Staff / Mozos ── */}
      {showStaff && (
        <StaffModal
          staff={staff}
          onClose={() => setShowStaff(false)}
        />
      )}

      {/* ── MODAL: Sectores ── */}
      {showSectors && (
        <SectoresModal
          sectors={config.sectors || []}
          staff={staff}
          onSave={(sectors) => saveConfig({ ...config, sectors })}
          onClose={() => setShowSectors(false)}
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
          if (current === 'en_postre_cafe') return ['sobremesa', 'esperando_cuenta'];
          if (current === 'sobremesa') return ['esperando_cuenta'];
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
// Subcomponentes que solo se usan en StaffDashboard
// ═══════════════════════════════════════════════════════════════════════════════
function AnalyticsPanel({ data, period, onPeriodChange, onClose }) {
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
            Object.entries(stateBreakdown)
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
                        <span style={{ color: C.muted }}>{(LIVE_STATES[state]?.label || state).slice(0, 6)}</span>
                        <span style={{ fontWeight: 600 }}>{fmtMin(avg)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
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
