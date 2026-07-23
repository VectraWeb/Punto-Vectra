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
import { syncMesasWithConfig } from '../services/mesasHelpers';
import { useCleaningTimers } from '../hooks/useCleaningTimers';
import { useReservations, useAnalyticsReservations } from '../hooks/useReservations';
import { useConfig } from '../hooks/useConfig';
import { useMesas } from '../hooks/useMesas';
import { useStaff } from '../hooks/useStaff';
import SalonFloor from './SalonFloor';
import LiveStateModal from './LiveStateModal';
import ResModal from './ResModal';
import SettingsModal from './SettingsModal';
import { AnalyticsPanel, Stat } from './AnalyticsPanel';
import { DashboardHeader } from './DashboardHeader';
import ReservationList from './ReservationList';
import TableGrid from './TableGrid';
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
const staffDoc = (id) => doc(db, 'staff', id);

// ═══════════════════════════════════════════════════════════════════════════════
// StaffDashboard — Dashboard completo para mozos (antes era App)
// ═══════════════════════════════════════════════════════════════════════════════
export default function StaffDashboard({ onLogout }) {
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayISO);
  const [service, setService] = useState(detectService);
  const [currentTime, setCurrentTime] = useState(() => detectTime(detectService()));
  const [online, setOnline] = useState(navigator.onLine);

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preTable, setPreTable] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showLiveMenu, setShowLiveMenu] = useState(null); // reserva seleccionada para cambiar estado
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('day');
  const [mainTab, setMainTab] = useState('mesas');
  const [editingLayout, setEditingLayout] = useState(false);
  const [optimisticStates, setOptimisticStates] = useState({});
  const [quickActionMenu, setQuickActionMenu] = useState(null);
  const [showStaff, setShowStaff] = useState(false);
  const [showSectors, setShowSectors] = useState(false);
  const [editingSectors, setEditingSectors] = useState(false);
  const deferredPrompt = useRef(null);
  const [canInstall, setCanInstall] = useState(false);
  const pressTimer = useRef(null);
  const isLongPress = useRef(false);
  const configLoaded = useRef(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Hooks de datos externos ────────────────────────────────────────────────
  const { config, sectors, setSectors, saveSectors } = useConfig();
  const mesas = useMesas(config);
  const staff = useStaff();
  const reservations = useReservations(date);
  const analyticsRes = useAnalyticsReservations(date, showAnalytics, analyticsPeriod);

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


  const lastDateRef = useRef(date);
  useEffect(() => {
    if (lastDateRef.current !== date && sectors.length > 0) {
      saveSectors([]);
    }
    lastDateRef.current = date;
  }, [date, sectors, saveSectors]);

  // ── Persistir configuración ────────────────────────────────────────────────────────
  const saveConfig = useCallback(async (c) => {
    try {
      await setDoc(cfgRef(), { mesaTipos: c, sectors }, { merge: true });
      await syncMesasWithConfig(c);
    } catch (e) { console.error(e); }
  }, [sectors]);

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
      if (liveState === 'para_limpiar') {
        patch.leftAt = serverTimestamp();
        patch.cleaningStartedAt = new Date().toISOString();
      }
      await updateDoc(resDocRef(res.id), patch);
      updateDoc(resDocRef(res.id), {
        stateLog: arrayUnion({ state: liveState, at: new Date().toISOString() }),
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
        stateLog: arrayUnion({ state: 'finalizado', at: new Date().toISOString() }),
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
        stateLog: arrayUnion({ state: 'liberada', at: new Date().toISOString() }),
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

  // ── Cleaning Timers ──────────────────────────────────────────────────────────
  const { cleaningTimers, finishNow, extendCleaning, cancelCleaning } = useCleaningTimers(reservations, date, tables);

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
      showToast(`La mesa no se puede reservar porque su estado actual es "${stateLabel}". Solo se pueden reservar mesas que estén libres o en estado "A limpiar".`);
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
      showToast(e.message || 'Error al guardar la reserva. Intentá de nuevo.');
    }
  }, [saveRes, service, date, editing, tableStatus]);

  const handleDelete = useCallback(async (resData) => {
    try {
      await deleteRes(resData);
      setShowModal(false); setEditing(null);
    } catch (e) {
      showToast('Error al eliminar la reserva. Intentá de nuevo.');
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
      <div style={{ minHeight: '100vh', background: C.cream, fontFamily: '"Manrope", system-ui, sans-serif' }}>
        {/* Header skeleton */}
        <div style={{ background: C.forest, padding: '24px 20px 28px', borderBottomLeftRadius: '28px', borderBottomRightRadius: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <div className="skeleton" style={{ width: '70px', height: '10px', marginBottom: '8px', opacity: 0.4 }} />
              <div className="skeleton" style={{ width: '80px', height: '30px', opacity: 0.4 }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ width: '38px', height: '38px', borderRadius: '12px', opacity: 0.3 }} />)}
            </div>
          </div>
          <div className="skeleton" style={{ width: '100%', height: '44px', borderRadius: '12px', opacity: 0.35 }} />
        </div>
        {/* Service tabs skeleton */}
        <div style={{ padding: '20px 16px 8px', display: 'flex', gap: '8px' }}>
          {[1,2].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: '56px', borderRadius: '14px' }} />)}
        </div>
        {/* Stats skeleton */}
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: '8px' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: '52px', borderRadius: '12px' }} />)}
        </div>
        {/* Tabs skeleton */}
        <div style={{ padding: '0 16px', display: 'flex', gap: '4px', marginBottom: '12px' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: '52px', borderRadius: '12px' }} />)}
        </div>
        {/* Table grid skeleton */}
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '6px' }}>
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '1', borderRadius: '10px' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.cream, color: C.espresso, fontFamily: '"Manrope", system-ui, sans-serif', paddingBottom: 'calc(120px + env(safe-area-inset-bottom, 0px))' }}>
      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '16px', left: '16px', right: '16px', zIndex: 9999,
          background: toast.type === 'error' ? '#fef2f2' : toast.type === 'success' ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${toast.type === 'error' ? C.terraSoft : toast.type === 'success' ? C.free : C.soon}`,
          borderRadius: '14px', padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
          fontSize: '13px', color: C.espresso, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          animation: 'modalIn 0.25s ease-out',
        }}>
          <span style={{ flex: 1 }}>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px',
          }}><X size={16} /></button>
        </div>
      )}

      {/* ── HEADER ── */}
      <DashboardHeader
        online={online}
        canInstall={canInstall}
        handleInstall={handleInstall}
        date={date}
        setDate={setDate}
        setShowAnalytics={setShowAnalytics}
        setShowSettings={setShowSettings}
        setShowStaff={setShowStaff}
        setShowSectors={setShowSectors}
        onLogout={onLogout}
      />

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
              transition: 'all 0.2s ease',
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
        <TableGrid
          tables={tables}
          tableStatus={tableStatus}
          onTableClick={(t, s) => {
            if (s.status === 'free') {
              setPreTable(t); setEditing(null); setShowModal(true);
            } else {
              setShowLiveMenu(s.res);
            }
          }}
        />
      )}

      {/* ── LISTADO DE RESERVAS ── */}
      {mainTab === 'reservas' && (
        <div style={{ padding: '0 16px 24px' }}>
          <ReservationList
            sortedRes={sortedRes}
            tables={tables}
            onEdit={(r) => { setEditing(r); setShowModal(true); }}
            onAction={(r) => setShowLiveMenu(r)}
          />
        </div>
      )}

      {/* ── PLANO DEL SALON ── */}
      {mainTab === 'plano' && (
        <SalonFloor
          tables={tables}
          tableStatus={tableStatus}
          cleaningTimers={cleaningTimers}
          isEditing={editingLayout}
          onToggleEdit={() => setEditingLayout(prev => !prev)}
          sectors={sectors}
          isEditingSectors={editingSectors}
          onToggleEditSectors={() => setEditingSectors(prev => !prev)}
          onSaveSectors={async (updatedSectors) => {
            setSectors(updatedSectors);
            await setDoc(cfgRef(), { sectors: updatedSectors }, { merge: true });
          }}
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
        position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', right: '24px',
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
          cleaningTimer={cleaningTimers[showLiveMenu.tableId] || null}
          onSelect={(state) => updateLiveState(showLiveMenu, state)}
          onEdit={() => { setEditing(showLiveMenu); setShowLiveMenu(null); setShowModal(true); }}
          onClose={() => setShowLiveMenu(null)}
          onFinalize={() => finishNow(showLiveMenu)}
          onReset={() => resetLiveState(showLiveMenu)}
          onExtend={() => extendCleaning(showLiveMenu)}
          onCancelCleaning={() => cancelCleaning(showLiveMenu)}
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
          sectors={sectors}
          staff={staff}
          onSave={async (updatedSectors) => {
            setSectors(updatedSectors);
            await setDoc(cfgRef(), { sectors: updatedSectors }, { merge: true });
          }}
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

